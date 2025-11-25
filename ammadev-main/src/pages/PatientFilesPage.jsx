import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import { getCurrentSession, logout } from '../utils/sessionManager'
import { searchEpicPatients, fetchPatientData, getStoredEpicData, isEpicConnected } from '../utils/epicClient'
import { generateClinicalSummary } from '../utils/fhirParser'
import { extractTextFromFile } from '../utils/fileExtractor'
import '../components/Profile.css'

function PatientFilesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { patientEmail, patientName } = location.state || {}
  
  const [doctorEmail, setDoctorEmail] = useState('')
  const [files, setFiles] = useState([])
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [extractedTexts, setExtractedTexts] = useState({}) // Store extracted text for each file
  
  // Epic integration state
  const [epicConnected, setEpicConnected] = useState(false)
  const [epicData, setEpicData] = useState(null)
  const [showEpicModal, setShowEpicModal] = useState(false)
  const [epicSearchQuery, setEpicSearchQuery] = useState('')
  const [epicSearchResults, setEpicSearchResults] = useState([])
  const [loadingEpic, setLoadingEpic] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    demographics: true,
    conditions: false,
    medications: false,
    notes: false,
    documents: false
  })

  useEffect(() => {
    checkSessionAndLoadData()
  }, [])

  const checkSessionAndLoadData = async () => {
    const session = await getCurrentSession()
    
    if (!session || session.userType !== 'doctor') {
      alert('⚠️ No active session found! Please log in.')
      navigate('/login')
      return
    }
    
    if (!patientEmail) {
      alert('⚠️ Missing patient information')
      navigate('/doctor')
      return
    }
    
    setDoctorEmail(session.email)
    loadFiles(session.email, patientEmail)
    checkEpicConnection(session.email)
  }
  
  const checkEpicConnection = async (email) => {
    try {
      const connected = await isEpicConnected(email)
      setEpicConnected(connected)
    } catch (error) {
      console.log('Error checking Epic connection:', error)
    }
  }

  const loadFiles = async (docEmail, patEmail) => {
    try {
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_email', patEmail)
        .eq('doctor_email', docEmail)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading files:', error)
      } else if (data) {
        const filesList = data.filter(f => f.file_type === 'file')
        const video = data.find(f => f.file_type === 'video')
        setFiles(filesList)
        setVideoUrl(video?.file_url || '')
      }
    } catch (error) {
      console.log('Error loading files:', error)
    }
    setLoading(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setUploading(true)
    
    try {
      // Extract text from file before uploading
      console.log('📄 Extracting text from file...')
      let extractedData = null
      try {
        extractedData = await extractTextFromFile(file)
        if (extractedData?.text) {
          console.log('✅ Text extraction successful:', extractedData.text.substring(0, 100) + '...')
        } else {
          console.log('⚠️ Text extraction returned no data')
        }
      } catch (extractError) {
        console.error('⚠️ Text extraction failed (non-critical):', extractError)
        // Continue with upload even if extraction fails
        extractedData = null
      }
      
      // Create unique file path: patient-files/{patientEmail}/{timestamp}-{filename}
      const timestamp = Date.now()
      const filePath = `${patientEmail}/${timestamp}-${file.name}`
      
      console.log('📤 Uploading to Supabase Storage...')
      console.log('📁 Bucket: patient-files')
      console.log('📂 Path:', filePath)
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError)
        alert('❌ Storage upload failed: ' + uploadError.message + '\n\nMake sure storage policies are set up.')
        setUploading(false)
        return
      }
      
      console.log('✅ File uploaded to storage:', uploadData)
      
      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('patient-files')
        .getPublicUrl(filePath)
      
      const publicUrl = urlData.publicUrl
      console.log('🔗 Public URL:', publicUrl)
      
      // Save file metadata to database (including extracted text)
      console.log('💾 Saving metadata to database...')
      
      const { data: insertData, error: dbError } = await supabase
        .from('patient_files')
        .insert([{
          doctor_email: doctorEmail,
          patient_email: patientEmail,
          file_type: 'file',
          file_url: publicUrl,
          file_name: file.name,
          extracted_text: extractedData?.text || null
        }])
        .select()
      
      if (dbError) {
        console.error('❌ Database error:', dbError)
        alert('❌ Database error: ' + dbError.message)
        setUploading(false)
        return
      }
      
      console.log('✅ Complete! File uploaded and saved.')
      if (extractedData?.text) {
        console.log('📄 Extracted text:', extractedData.text.substring(0, 200) + '...')
      }
      await loadFiles(doctorEmail, patientEmail)
      alert('✅ File uploaded successfully!' + (extractedData?.text ? ' Text extracted and saved.' : ''))
      
    } catch (error) {
      console.error('❌ Upload failed:', error)
      alert('❌ Upload failed: ' + error.message)
    }
    
    setUploading(false)
  }

  const handleDeleteFile = async (fileId, fileName, fileUrl) => {
    if (!confirm(`Delete "${fileName}"?`)) return
    
    try {
      console.log('🗑️ Deleting file:', { fileId, fileName, fileUrl })
      
      // Extract file path from URL
      // URL format: https://.../storage/v1/object/public/patient-files/email@example.com/timestamp-file.pdf
      const urlParts = fileUrl.split('/patient-files/')
      const filePath = urlParts[1]
      
      // Delete from storage
      if (filePath) {
        console.log('🗑️ Deleting from storage:', filePath)
        const { error: storageError } = await supabase.storage
          .from('patient-files')
          .remove([filePath])
        
        if (storageError) {
          console.warn('⚠️ Storage delete warning:', storageError)
          // Continue anyway - might already be deleted
        }
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('patient_files')
        .delete()
        .eq('id', fileId)
      
      if (dbError) {
        alert('❌ Error deleting file: ' + dbError.message)
        return
      }
      
      console.log('✅ File deleted successfully')
      await loadFiles(doctorEmail, patientEmail)
      alert('✅ File deleted!')
      
    } catch (error) {
      console.error('❌ Delete failed:', error)
      alert('❌ Delete failed: ' + error.message)
    }
  }

  const handleGenerateVideo = async () => {
    try {
      console.log('🎬 Generating video...')
      
      // Set the demo video URL
      const demoVideoPath = '/images/20251121_0810_01kakjqdsse5jb6f3mdz9p3j0t.mp4'
      
      // Save video reference to database
      const { data, error } = await supabase
        .from('patient_files')
        .insert([{
          doctor_email: doctorEmail,
          patient_email: patientEmail,
          file_type: 'video',
          file_url: demoVideoPath,
          file_name: 'generated_video.mp4'
        }])
        .select()
      
      if (error) {
        console.error('Error saving video:', error)
      }
      
      setVideoUrl(demoVideoPath)
      
      // Log clinical summary if Epic data is available
      if (epicData) {
        const summary = generateClinicalSummary(epicData)
        console.log('Clinical Summary for Video:', summary)
      }
      
      alert('✅ Video generated successfully!')
    } catch (error) {
      console.error('Error generating video:', error)
      alert('Error generating video: ' + error.message)
    }
  }
  
  const handlePullFromEpic = () => {
    setShowEpicModal(true)
  }
  
  const handleEpicSearch = async () => {
    if (!epicSearchQuery.trim()) {
      alert('Please enter a patient name or MRN to search')
      return
    }
    
    setLoadingEpic(true)
    try {
      const results = await searchEpicPatients(doctorEmail, epicSearchQuery)
      setEpicSearchResults(results)
      
      if (results.length === 0) {
        alert('No patients found matching: ' + epicSearchQuery)
      }
    } catch (error) {
      console.error('Epic search error:', error)
      alert('Failed to search Epic: ' + error.message)
    }
    setLoadingEpic(false)
  }
  
  const handleSelectEpicPatient = async (epicPatient) => {
    setLoadingEpic(true)
    setShowEpicModal(false)
    
    try {
      console.log('Fetching patient data from Epic:', epicPatient.id)
      const data = await fetchPatientData(doctorEmail, epicPatient.id)
      setEpicData(data)
      alert(`Successfully pulled data for ${epicPatient.name} from Epic!`)
    } catch (error) {
      console.error('Failed to fetch Epic data:', error)
      alert('Failed to fetch patient data: ' + error.message)
    }
    setLoadingEpic(false)
  }
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #f5f3ff 100%)' }}><div style={{ color: '#A855F7', fontSize: '1.1rem', fontWeight: '600' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '2rem 6%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            marginBottom: '0.5rem',
            color: '#1f2937'
          }}>
            Manage Files for {patientName} 📁
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#64748b' }}>Patient: {patientEmail}</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/doctor')}
              style={{
                padding: '0.75rem 1.75rem',
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                color: '#64748b',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#7c3aed'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              ← Back to Dashboard
            </button>
            <button 
              onClick={handleLogout}
              style={{
                padding: '0.75rem 1.75rem',
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Upload & Generate Section - Full Width */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
            Upload Files & Generate Video
          </h3>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {epicConnected && (
              <button 
                onClick={handlePullFromEpic}
                disabled={loadingEpic}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: loadingEpic ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: loadingEpic ? 0.6 : 1
                }}
              >
                {loadingEpic ? '⏳ Loading from Plasma FHIR...' : '🏥 Pull from Plasma FHIR (Epic)'}
              </button>
            )}
            
            <label htmlFor="file-upload" style={{
              flex: 1,
              display: 'block',
              padding: '1rem 1.5rem',
              background: 'white',
              border: '2px dashed #e5e7eb',
              borderRadius: '10px',
              textAlign: 'center',
              cursor: 'pointer',
              color: '#64748b',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7c3aed'
              e.currentTarget.style.background = '#faf5ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.background = 'white'
            }}
            >
              {uploading ? 'Uploading...' : '📁 Click to Upload File'}
            </label>
            <input 
              id="file-upload" 
              type="file" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              disabled={uploading}
            />

            <button 
              onClick={handleGenerateVideo}
              style={{
                flex: 1,
                padding: '1rem',
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Generate Video 🎬
            </button>
          </div>
        </div>

        {/* Video Preview - Only show when video exists */}
        {videoUrl && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#1f2937' }}>
              Generated Video Preview
            </h3>
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '1rem',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <video 
                controls 
                style={{ 
                  width: '100%', 
                  maxHeight: '500px',
                  borderRadius: '8px'
                }}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        )}

        {/* Main Grid - Epic Data & Uploaded Files Side by Side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* Left: Epic Data from Plasma FHIR */}
          {epicData ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                  Plasma FHIR Data (Epic)
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
                  Last synced: {new Date().toLocaleString()}
                </p>
              </div>

              {/* Patient Demographics */}
              {epicData.patient && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => toggleSection('demographics')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: expandedSections.demographics ? '#faf5ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>📋 Patient Demographics</span>
                    <span style={{ color: '#7c3aed' }}>{expandedSections.demographics ? '−' : '+'}</span>
                  </button>
                  {expandedSections.demographics && (
                    <div style={{ padding: '1rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', marginTop: '-1px' }}>
                      <p style={{ color: '#1f2937', marginBottom: '0.5rem' }}><strong>Name:</strong> {epicData.patient.name}</p>
                      <p style={{ color: '#1f2937', marginBottom: '0.5rem' }}><strong>Age:</strong> {epicData.patient.age} years</p>
                      <p style={{ color: '#1f2937', marginBottom: '0.5rem' }}><strong>Gender:</strong> {epicData.patient.gender}</p>
                      <p style={{ color: '#1f2937' }}><strong>MRN:</strong> {epicData.patient.mrn}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Conditions */}
              {epicData.conditions && epicData.conditions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => toggleSection('conditions')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: expandedSections.conditions ? '#faf5ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>🩺 Diagnoses ({epicData.conditions.length})</span>
                    <span style={{ color: '#7c3aed' }}>{expandedSections.conditions ? '−' : '+'}</span>
                  </button>
                  {expandedSections.conditions && (
                    <div style={{ padding: '1rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', marginTop: '-1px' }}>
                      {epicData.conditions.map((condition, idx) => (
                        <div key={idx} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: idx < epicData.conditions.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <p style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1f2937' }}>{condition.display}</p>
                          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                            Status: {condition.clinicalStatus || 'Unknown'}
                            {condition.onsetDate && ` • Since: ${new Date(condition.onsetDate).toLocaleDateString()}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Medications */}
              {epicData.medications && epicData.medications.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => toggleSection('medications')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: expandedSections.medications ? '#faf5ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>💊 Medications ({epicData.medications.length})</span>
                    <span style={{ color: '#7c3aed' }}>{expandedSections.medications ? '−' : '+'}</span>
                  </button>
                  {expandedSections.medications && (
                    <div style={{ padding: '1rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', marginTop: '-1px' }}>
                      {epicData.medications.map((med, idx) => (
                        <div key={idx} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: idx < epicData.medications.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <p style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1f2937' }}>{med.name}</p>
                          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                            {med.dosage && `Dosage: ${med.dosage}`}
                            {med.frequency && ` • ${med.frequency}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clinical Notes */}
              {epicData.clinical_notes && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => toggleSection('notes')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: expandedSections.notes ? '#faf5ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>📋 Full Clinical Notes</span>
                    <span style={{ color: '#7c3aed' }}>{expandedSections.notes ? '−' : '+'}</span>
                  </button>
                  {expandedSections.notes && (
                    <div style={{ padding: '1.5rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', marginTop: '-1px', maxHeight: '600px', overflowY: 'auto' }}>
                      <div style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.85rem', 
                        color: '#1f2937', 
                        whiteSpace: 'pre-wrap',
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        lineHeight: '1.6'
                      }}>
                        {epicData.clinical_notes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document References */}
              {epicData.documents && epicData.documents.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => toggleSection('documents')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: expandedSections.documents ? '#faf5ff' : 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>📄 Related Documents ({epicData.documents.length})</span>
                    <span style={{ color: '#7c3aed' }}>{expandedSections.documents ? '−' : '+'}</span>
                  </button>
                  {expandedSections.documents && (
                    <div style={{ padding: '1rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', marginTop: '-1px' }}>
                      {epicData.documents.map((doc, idx) => (
                        <div key={idx} style={{ 
                          marginBottom: '0.75rem', 
                          paddingBottom: '0.75rem', 
                          borderBottom: idx < epicData.documents.length - 1 ? '1px solid #e5e7eb' : 'none',
                          background: 'white',
                          padding: '1rem',
                          borderRadius: '6px'
                        }}>
                          <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#1f2937' }}>{doc.type}</p>
                          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                            {doc.date && `Date: ${new Date(doc.date).toLocaleDateString()}`}
                            {doc.author && ` • Author: ${doc.author}`}
                          </p>
                          {doc.content && (
                            <p style={{ fontSize: '0.9rem', color: '#374151', marginTop: '0.5rem', fontStyle: 'italic' }}>
                              {doc.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '3rem 2rem',
              border: '2px dashed #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏥</div>
              <p style={{ color: '#9ca3af', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Epic Data Loaded</p>
              <p style={{ color: '#d1d5db', fontSize: '0.95rem' }}>Click "Pull from Plasma FHIR" above to load patient data</p>
            </div>
          )}

          {/* Right: Patient Files List */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#1f2937' }}>
              Uploaded Files ({files.length})
            </h3>
            
            {files.length === 0 ? (
              <div style={{
                border: '2px dashed #e5e7eb',
                borderRadius: '8px',
                padding: '3rem 2rem',
                textAlign: 'center',
                background: '#fafafa',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                <p style={{ color: '#9ca3af', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No files uploaded yet</p>
                <p style={{ color: '#d1d5db', fontSize: '0.95rem' }}>Upload files using the section above</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                {files.map((file, index) => (
                  <div key={index} style={{
                    padding: '1rem',
                    background: '#fafafa',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    border: '1px solid #e5e7eb',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f3ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                  >
                    <div style={{ fontSize: '2rem' }}>📄</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.25rem', color: '#1f2937' }}>{file.file_name}</p>
                      <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        Uploaded {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <a 
                        href={file.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.file_name, file.file_url)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Epic Search Modal */}
      {showEpicModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowEpicModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              border: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#1a1a1a' }}>
              🔍 Search Patients (Plasma FHIR)
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#666', marginBottom: '1.5rem' }}>
              Enter patient name or MRN to search via Plasma FHIR (synced with Epic)
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                value={epicSearchQuery}
                onChange={(e) => setEpicSearchQuery(e.target.value)}
                placeholder="Patient name or MRN"
                onKeyPress={(e) => e.key === 'Enter' && handleEpicSearch()}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleEpicSearch}
                disabled={loadingEpic}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: loadingEpic ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  opacity: loadingEpic ? 0.6 : 1
                }}
              >
                {loadingEpic ? '...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {epicSearchResults.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a1a1a' }}>
                  Results ({epicSearchResults.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {epicSearchResults.map((patient, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectEpicPatient(patient)}
                      style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f0f0f0';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                      }}
                    >
                      <p style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#1a1a1a' }}>{patient.name}</p>
                      <p style={{ fontSize: '0.9rem', color: '#666' }}>
                        {patient.birthDate && `DOB: ${patient.birthDate}`}
                        {patient.mrn && ` • MRN: ${patient.mrn}`}
                        {patient.gender && ` • ${patient.gender}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowEpicModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#666',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatientFilesPage

