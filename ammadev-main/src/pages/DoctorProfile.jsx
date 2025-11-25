import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import { getCurrentSession, logout } from '../utils/sessionManager'
import { isValidPatientKey, unformatPatientKey, formatPatientKey } from '../utils/keyGenerator'
import EpicConnect from '../components/EpicConnect'
import { FiUsers, FiLogOut, FiPlus, FiSearch, FiFileText, FiUser, FiCalendar, FiActivity, FiClock } from 'react-icons/fi'
import { MdMedicalServices } from 'react-icons/md'
import '../components/Profile.css'

function DoctorProfile() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('Doctor')
  const [userEmail, setUserEmail] = useState('')
  const [profilePicture, setProfilePicture] = useState('')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [patientKey, setPatientKey] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    checkSessionAndLoadData()
  }, [])

  const checkSessionAndLoadData = async () => {
    console.log('👨‍⚕️ DoctorProfile: Checking session...')
    
    try {
      const session = await getCurrentSession()
      console.log('👨‍⚕️ Session data:', session)
      
      if (!session || session.userType !== 'doctor') {
        console.log('❌ No valid doctor session')
        alert('⚠️ No active session found! Please log in.')
        navigate('/login')
        return
      }
      
      console.log('✅ Valid doctor session found')
      setUserEmail(session.email)
      setProfilePicture(session.profilePicture || '')
      
      // Load proper name from database
      await loadDoctorName(session.email, session.name)
      loadPatients(session.email)
    } catch (error) {
      console.error('❌ Error checking session:', error)
      alert('Error loading profile: ' + error.message)
      navigate('/login')
    }
  }

  const loadDoctorName = async (email, fallbackName) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('email', email)
        .eq('user_type', 'doctor')
        .single()

      if (error) throw error
      if (data && (data.first_name || data.last_name)) {
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim()
        setUserName(fullName || fallbackName)
      } else {
        setUserName(fallbackName)
      }
    } catch (error) {
      console.log('Error loading doctor name:', error)
      setUserName(fallbackName)
    }
  }

  const loadPatients = async (docEmail) => {
    console.log('🔍 Loading patients for doctor:', docEmail)
    
    try {
      const { data: patientLinks, error: linkError } = await supabase
        .from('doctor_patients')
        .select('patient_email, patient_key')
        .eq('doctor_email', docEmail)

      if (linkError) {
        console.error('Error loading patient links:', linkError)
        setLoading(false)
        return
      }

      console.log('📋 Patient links found:', patientLinks)

      if (!patientLinks || patientLinks.length === 0) {
        console.log('No patients found for this doctor')
        setPatients([])
        setLoading(false)
        return
      }

      // Fetch patient details with profile pictures
      const patientEmails = patientLinks.map(link => link.patient_email)
      
      // Try to fetch with profile_picture, if it fails, fetch without it
      let patientData = null
      let patientError = null
      
      try {
        const result = await supabase
          .from('users')
          .select('email, first_name, last_name, profile_picture')
          .in('email', patientEmails)
          .eq('user_type', 'patient')
        
        patientData = result.data
        patientError = result.error
      } catch (err) {
        // If profile_picture column doesn't exist, try without it
        console.log('⚠️ Trying to fetch patients without profile_picture column...')
        const result = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .in('email', patientEmails)
          .eq('user_type', 'patient')
        
        patientData = result.data
        patientError = result.error
      }

      if (patientError) {
        console.error('Error loading patient data:', patientError)
      }

      const patientsWithInfo = patientLinks.map(link => {
        const patientInfo = patientData?.find(p => p.email === link.patient_email)
        const firstName = patientInfo?.first_name || link.patient_email.split('@')[0]
        const lastName = patientInfo?.last_name || ''
        const fullName = `${firstName} ${lastName}`.trim()
        const profilePic = patientInfo?.profile_picture || null
        
        console.log(`Patient ${link.patient_email} profile picture:`, profilePic)
        
        return {
          email: link.patient_email,
          name: fullName || link.patient_email,
          patientKey: link.patient_key,
          profilePicture: profilePic
        }
      })

      console.log('👥 Loaded patients with profile pictures:', patientsWithInfo)
      setPatients(patientsWithInfo)
    } catch (error) {
      console.error('Error in loadPatients:', error)
    }
    
    setLoading(false)
  }

  const handleAddPatient = async () => {
    if (!patientKey.trim()) {
      alert('Please enter a patient ID')
      return
    }

    const cleanKey = unformatPatientKey(patientKey)

    if (!isValidPatientKey(cleanKey)) {
      alert('❌ Invalid Patient ID format. Please check and try again.')
      return
    }

    try {
      // Find patient by key
      const { data: patientData, error: patientError } = await supabase
        .from('users')
        .select('email, first_name, last_name, patient_key, profile_picture')
        .eq('patient_key', cleanKey)
        .eq('user_type', 'patient')
        .single()

      if (patientError || !patientData) {
        alert('❌ No patient found with this ID. Please check the ID and try again.')
        return
      }

      // Check if already linked
      const { data: existingLink } = await supabase
        .from('doctor_patients')
        .select('*')
        .eq('doctor_email', userEmail)
        .eq('patient_email', patientData.email)
        .single()

      if (existingLink) {
        alert('⚠️ This patient is already in your roster!')
        setShowModal(false)
        setPatientKey('')
        return
      }

      // Create link
      const { error: insertError } = await supabase
        .from('doctor_patients')
        .insert([{
          doctor_email: userEmail,
          patient_email: patientData.email,
          patient_key: cleanKey
        }])

      if (insertError) {
        console.error('Error linking patient:', insertError)
        alert('❌ Error adding patient: ' + insertError.message)
        return
      }

      alert('✅ Patient added successfully!')
      setShowModal(false)
      setPatientKey('')
      loadPatients(userEmail)
    } catch (error) {
      console.error('Error adding patient:', error)
      alert('❌ Error adding patient: ' + error.message)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (patient.patientKey && patient.patientKey.includes(searchQuery))
  )

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #A855F7 0%, #E879F9 50%, #F472B6 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <FiActivity size={48} style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Professional Header */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.15)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left side - Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <img 
              src="/images/Black Elephant Flat Illustrative Company Logo.png" 
              alt="Amma Logo" 
              style={{ height: '50px', width: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.02em'
              }}>
                Clinical Dashboard
              </h1>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.25rem' }}>
                Welcome back, Dr. {userName}
              </p>
            </div>
          </div>

          {/* Right side - Profile and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Epic Connect */}
            <EpicConnect doctorEmail={userEmail} />

            {/* Profile Picture */}
            <div style={{ 
              width: '45px', 
              height: '45px', 
              borderRadius: '50%', 
              overflow: 'hidden',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}>
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt={userName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FiUser size={24} color="white" />
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <FiLogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Page Header with Clean Card */}
        <div style={{ 
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
              Patient Roster
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>
              Manage your patients and access their medical records
            </p>
          </div>
          
          {/* Add Patient Button */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 58, 237, 0.25)'
            }}
          >
            <FiPlus size={18} />
            Add New Patient
          </button>
        </div>

        {/* Search Bar */}
        {patients.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ position: 'relative', maxWidth: '500px' }}>
              <FiSearch 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} 
              />
              <input
                type="text"
                placeholder="Search patients by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem 0.875rem 3rem',
                  borderRadius: '10px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#7c3aed'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Patient Grid */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.8)'
        }}>
          {filteredPatients.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '5rem 2rem',
              background: 'linear-gradient(135deg, rgba(250, 232, 255, 0.5) 0%, rgba(245, 243, 255, 0.5) 100%)',
              borderRadius: '16px',
              border: '2px dashed rgba(168, 85, 247, 0.3)'
            }}>
              <FiUsers size={64} color="#A855F7" style={{ opacity: 0.6 }} />
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#A855F7', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                {searchQuery ? 'No Patients Found' : 'No Patients Yet'}
              </h3>
              <p style={{ fontSize: '1.05rem', color: '#64748b', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                {searchQuery 
                  ? `No patients match "${searchQuery}". Try a different search term.`
                  : 'Start building your patient roster by clicking "Add New Patient" to sync with a patient using their Patient ID'
                }
              </p>
              {!searchQuery && (
                <div style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, rgba(232, 121, 249, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  borderRadius: '10px',
                  display: 'inline-block',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#A855F7',
                  border: '1px solid rgba(168, 85, 247, 0.3)'
                }}>
                  💡 Patients share their 9-digit ID with you
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem'
            }}>
              {filteredPatients.map((patient, index) => (
                <div 
                  key={index} 
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #fdf4ff 100%)',
                    borderRadius: '16px',
                    padding: '2rem',
                    border: '2px solid #fae8ff',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)'
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(232, 121, 249, 0.2)'
                    e.currentTarget.style.borderColor = '#E879F9'
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fae8ff 100%)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
                    e.currentTarget.style.borderColor = '#fae8ff'
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fdf4ff 100%)'
                  }}
                  onClick={() => navigate('/patient-files', { 
                    state: { 
                      patientEmail: patient.email,
                      patientName: patient.name
                    }
                  })}
                >
                  {/* Top Badge - Patient ID */}
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'linear-gradient(135deg, #fae8ff 0%, #f3e8ff 100%)',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#A855F7',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em'
                  }}>
                    {patient.patientKey ? formatPatientKey(patient.patientKey) : 'No ID'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Profile Picture */}
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '4px solid #E879F9',
                      boxShadow: '0 8px 20px rgba(232, 121, 249, 0.25)',
                      background: 'white'
                    }}>
                      {patient.profilePicture ? (
                        <img 
                          src={patient.profilePicture} 
                          alt={patient.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #fae8ff 0%, #f3e8ff 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <FiUser size={48} color="#A855F7" />
                        </div>
                      )}
                    </div>

                    {/* Patient Info */}
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: '#1f2937',
                        margin: '0 0 0.5rem 0',
                        wordBreak: 'break-word'
                      }}>
                        {patient.name}
                      </h3>
                      <p style={{
                        fontSize: '0.9rem',
                        color: '#6b7280',
                        margin: '0 0 1.5rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <FiUser size={14} />
                        {patient.email}
                      </p>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                        <button
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(232, 121, 249, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/patient-files', { 
                              state: { 
                                patientEmail: patient.email,
                                patientName: patient.name
                              }
                            })
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)'
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(232, 121, 249, 0.4)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(232, 121, 249, 0.3)'
                          }}
                        >
                          <FiFileText size={16} />
                          View Records
                        </button>
                      </div>

                      {/* Quick Stats */}
                      <div style={{
                        marginTop: '1.25rem',
                        padding: '1rem',
                        background: 'linear-gradient(135deg, #fdf4ff 0%, #faf5ff 100%)',
                        borderRadius: '10px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <FiFileText size={18} color="#A855F7" style={{ marginBottom: '0.25rem' }} />
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Files</div>
                          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937' }}>—</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <FiClock size={18} color="#A855F7" style={{ marginBottom: '0.25rem' }} />
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Last Visit</div>
                          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937' }}>—</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Patient Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(168, 85, 247, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(253, 244, 255, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '2.5rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 24px 60px rgba(232, 121, 249, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: '70px',
                height: '70px',
                margin: '0 auto 1.25rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(232, 121, 249, 0.3)'
              }}>
                <FiPlus size={32} color="white" />
              </div>
              <h3 style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                color: '#A855F7',
                margin: '0 0 0.5rem 0'
              }}>
                Add New Patient
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#64748b',
                margin: 0
              }}>
                Enter the patient's 9-digit ID to add them to your roster
              </p>
            </div>

            {/* Input Field */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Patient ID
              </label>
              <input
                type="text"
                value={patientKey}
                onChange={(e) => setPatientKey(e.target.value)}
                placeholder="123-456-789"
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1.1rem',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddPatient()
                }}
              />
              <p style={{
                fontSize: '0.85rem',
                color: '#6b7280',
                marginTop: '0.5rem',
                textAlign: 'center'
              }}>
                Patients can find their ID in the top-right corner of their dashboard
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowModal(false)
                  setPatientKey('')
                }}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db'
                  e.currentTarget.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.background = 'white'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPatient}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #E879F9 0%, #A855F7 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(232, 121, 249, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(232, 121, 249, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(232, 121, 249, 0.3)'
                }}
              >
                Add Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default DoctorProfile

