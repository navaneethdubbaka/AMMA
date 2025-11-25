import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import { getCurrentSession, logout } from '../utils/sessionManager'
import { formatPatientKey, copyToClipboard } from '../utils/keyGenerator'
import { FiVideo, FiMessageCircle, FiCalendar, FiLogOut, FiCopy, FiCheck, FiSend, FiUser, FiHelpCircle, FiActivity } from 'react-icons/fi'
import { MdMedicalServices } from 'react-icons/md'
import '../components/Profile.css'

function PatientProfile() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('Patient')
  const [userEmail, setUserEmail] = useState('')
  const [profilePicture, setProfilePicture] = useState('')
  const [patientKey, setPatientKey] = useState('')
  const [keyCopied, setKeyCopied] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Tab state - 'diagnosis', 'chat', 'recovery'
  const [activeTab, setActiveTab] = useState('diagnosis')
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  
  // Patient medical data for AI chat
  const [patientMedicalData, setPatientMedicalData] = useState(null)
  const [uploadedFilesData, setUploadedFilesData] = useState([])
  
  // Recovery plan state
  const [recoveryVideos, setRecoveryVideos] = useState([])

  useEffect(() => {
    checkSessionAndLoadData()
  }, [])

  const checkSessionAndLoadData = async () => {
    console.log('👤 PatientProfile: Checking session...')
    
    try {
      const session = await getCurrentSession()
      console.log('👤 Session data:', session)
      
      if (!session || session.userType !== 'patient') {
        console.log('❌ No valid patient session')
        alert('⚠️ No active session found! Please log in.')
        navigate('/login')
        return
      }
      
      console.log('✅ Valid patient session found')
      setUserName(session.name)
      setUserEmail(session.email)
      setProfilePicture(session.profilePicture || '')
      await loadPatientKey(session.email)
      await loadFiles(session.email)
      await loadPatientMedicalData(session.email)
      await loadUploadedFiles(session.email)
      loadRecoveryPlan()
    } catch (error) {
      console.error('❌ Error checking session:', error)
      alert('Error loading profile: ' + error.message)
      navigate('/login')
    }
  }

  const loadPatientKey = async (email) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('patient_key, first_name, last_name')
        .eq('email', email)
        .eq('user_type', 'patient')
        .single()

      if (error) throw error
      if (data) {
        if (data.patient_key) {
        setPatientKey(data.patient_key)
        }
        // Update name with proper first and last name
        if (data.first_name || data.last_name) {
          const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim()
          if (fullName) {
            setUserName(fullName)
          }
        }
      }
    } catch (error) {
      console.log('Error loading patient data:', error)
    }
  }

  const loadFiles = async (email) => {
    try {
      // Patients can only see videos, not uploaded files
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_email', email)
        .eq('file_type', 'video') // Only fetch videos
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading files:', error)
      } else if (data && data.length > 0) {
        setVideoUrl(data[0].file_url)
      }
    } catch (error) {
      console.log('Error loading files:', error)
    }
    setLoading(false)
  }

  const loadPatientMedicalData = async (email) => {
    try {
      // Load Epic patient data if available
      const { data: epicData, error: epicError } = await supabase
        .from('epic_patient_data')
        .select('*')
        .eq('patient_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (epicError && epicError.code !== 'PGRST116') {
        console.error('Error loading Epic data:', epicError)
      }

      setPatientMedicalData(epicData)
    } catch (error) {
      console.log('Error loading patient medical data:', error)
    }
  }

  const loadUploadedFiles = async (email) => {
    try {
      // Load uploaded files with extracted text
      const { data: filesData, error: filesError } = await supabase
        .from('patient_files')
        .select('extracted_text, file_name')
        .eq('patient_email', email)
        .eq('file_type', 'file')
        .order('created_at', { ascending: false })

      if (filesError) {
        console.error('Error loading uploaded files:', filesError)
      } else {
        setUploadedFilesData(filesData || [])
      }
    } catch (error) {
      console.log('Error loading uploaded files:', error)
    }
  }

  const loadRecoveryPlan = () => {
    // Generate 30-day recovery plan with 10 milestone videos
    const milestones = [1, 3, 5, 7, 10, 14, 17, 21, 24, 30]
    const videos = milestones.map((day) => ({
      day,
      title: `Day ${day} Recovery Checkpoint`,
      description: getRecoveryDescription(day),
      videoUrl: '/images/20251121_0810_01kakjqdsse5jb6f3mdz9p3j0t.mp4',
      locked: day > getCurrentDay()
    }))
    setRecoveryVideos(videos)
  }

  const getRecoveryDescription = (day) => {
    const descriptions = {
      1: 'Initial assessment and care instructions',
      3: 'Early recovery progress check',
      5: 'Wound healing and medication review',
      7: 'First week milestone - mobility assessment',
      10: 'Pain management and physical therapy',
      14: 'Two-week checkup and activity guidance',
      17: 'Mid-recovery wellness check',
      21: 'Three-week progress and independence',
      24: 'Advanced recovery exercises',
      30: 'Final milestone and long-term care plan'
    }
    return descriptions[day] || 'Recovery progress checkpoint'
  }

  const getCurrentDay = () => {
    // For demo, return day 7 (unlocks first 7 days)
    return 7
  }

  const handleCopyKey = async () => {
    const success = await copyToClipboard(patientKey)
    if (success) {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    // Simulate AI response
    setTimeout(async () => {
      const aiResponseContent = generateAIResponse(userMessage, patientMedicalData, uploadedFilesData)
      const newMessages = [...chatMessages, { role: 'user', content: userMessage }, {
        role: 'assistant',
        content: aiResponseContent,
        timestamp: new Date().toISOString()
      }]
      setChatMessages(newMessages)
      setChatLoading(false)
    }, 1000)
  }

  const handleGenerateVideoFromChat = async (messageIndex) => {
    const demoVideoPath = '/images/20251121_0810_01kakjqdsse5jb6f3mdz9p3j0t.mp4'
    const videoMessage = {
      role: 'assistant',
      content: `Here is a personalized video explanation based on our discussion:`,
      videoUrl: demoVideoPath,
      timestamp: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, videoMessage])
    setVideoUrl(demoVideoPath) // Also update the main video display

    // Save to database
    try {
      await supabase
        .from('patient_files')
        .insert([{
          doctor_email: 'system@amma.health',
          patient_email: userEmail,
          file_type: 'video',
          file_url: demoVideoPath,
          file_name: `ai_generated_video_${new Date().getTime()}.mp4`
        }])
    } catch (error) {
      console.error('Error saving video:', error)
    }
  }

  const generateAIResponse = (userMessage, medicalData, filesData) => {
    const lowerMessage = userMessage.toLowerCase()
    
    // Check if medical data is available
    const hasMedicalData = medicalData || (filesData && filesData.length > 0)
    
    if (lowerMessage.includes('diagnosis') || lowerMessage.includes('condition')) {
      if (medicalData?.diagnoses) {
        return `Based on your medical records, your condition includes: ${medicalData.diagnoses}. This means your body is experiencing specific health challenges that we're actively managing with your treatment plan.`
      }
      return "Your diagnosis information will be available here once your doctor uploads your medical records or syncs with Epic."
    }
    
    if (lowerMessage.includes('medication') || lowerMessage.includes('medicine')) {
      if (medicalData?.medications) {
        return `You are currently prescribed: ${medicalData.medications}. It's important to take these as directed. Would you like a video explaining how these medications work?`
      }
      return "Your medication information will appear here once your doctor adds it to your records."
    }
    
    if (lowerMessage.includes('recovery') || lowerMessage.includes('healing')) {
      return "Recovery is a journey that takes time. Focus on rest, proper nutrition, following your medication schedule, and attending all follow-up appointments. Check the Recovery Plan tab for your personalized 30-day recovery roadmap."
    }
    
    if (lowerMessage.includes('pain')) {
      return "Pain management is crucial for recovery. If you're experiencing pain beyond what your prescribed medications can manage, contact your doctor immediately. In the meantime, rest, ice/heat therapy (as instructed), and elevation can help."
    }
    
    if (hasMedicalData) {
      return `I'm here to help you understand your health better. You can ask me about your diagnosis, medications, recovery process, or any symptoms you're experiencing. Would you like me to create a video explanation for any specific topic?`
    }
    
    return "Hello! I'm your AI health assistant. Once your doctor uploads your medical information or syncs with Epic, I'll be able to answer detailed questions about your condition, medications, and recovery plan. Feel free to ask me anything!"
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <FiActivity size={48} style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Loading your health dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Professional Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
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
                Patient Portal
          </h1>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.25rem' }}>
                Welcome back, {userName}
              </p>
            </div>
          </div>

          {/* Right side - Profile and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Patient Key Badge - Small Corner Version */}
            {patientKey && (
              <div 
                onClick={handleCopyKey}
              style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  ':hover': { background: 'rgba(255, 255, 255, 0.25)' }
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Patient ID
                  </span>
                  <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {formatPatientKey(patientKey)}
                  </span>
                </div>
                {keyCopied ? (
                  <FiCheck size={18} color="white" />
                ) : (
                  <FiCopy size={16} color="rgba(255, 255, 255, 0.9)" />
                )}
              </div>
            )}

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

        {/* Tab Navigation */}
          <div style={{
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '0 2rem',
          display: 'flex',
          gap: '0.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {[
            { id: 'diagnosis', label: 'Diagnosis Video', icon: FiVideo },
            { id: 'chat', label: 'AI Health Assistant', icon: FiMessageCircle },
            { id: 'recovery', label: '30-Day Recovery Plan', icon: FiCalendar }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '1rem 1.5rem',
                  background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '3px solid white' : '3px solid transparent',
                  color: 'white',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: activeTab === tab.id ? 1 : 0.8
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.opacity = '0.8'
                  }
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Diagnosis Video Tab */}
        {activeTab === 'diagnosis' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '700', 
                color: '#1f2937',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <FiVideo size={28} color="#667eea" />
                Your Personalized Diagnosis Video
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>
                Watch this video to understand your diagnosis and treatment plan
              </p>
            </div>

            {videoUrl ? (
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                background: '#000'
              }}>
                <video 
                  controls 
                  style={{ 
                    width: '100%', 
                    maxHeight: '600px',
                    display: 'block'
                  }}
                  src={videoUrl}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '5rem 2rem',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                borderRadius: '12px',
                border: '2px dashed #d1d5db'
              }}>
                <MdMedicalServices size={64} color="#9ca3af" />
                <h3 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '600', 
                  color: '#4b5563',
                  margin: '1.5rem 0 0.75rem'
                }}>
                  No Video Available Yet
                </h3>
                <p style={{ fontSize: '1rem', color: '#6b7280', maxWidth: '500px', margin: '0 auto' }}>
                  Your doctor will generate a personalized video explanation of your diagnosis. 
                  Check back soon or contact your healthcare provider.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI Chat Tab */}
        {activeTab === 'chat' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '700', 
                color: '#1f2937',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <FiMessageCircle size={28} color="#667eea" />
                AI Health Assistant
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>
                Ask questions about your condition, medications, and recovery plan
              </p>
            </div>

            {/* Chat Messages */}
            <div style={{
              minHeight: '400px',
              maxHeight: '500px',
              overflowY: 'auto',
              marginBottom: '1.5rem',
              padding: '1.5rem',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                  <FiHelpCircle size={48} color="#9ca3af" />
                  <p style={{ color: '#6b7280', marginTop: '1rem', fontSize: '1.05rem' }}>
                    Start a conversation by asking a question below
                  </p>
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px', margin: '1.5rem auto 0' }}>
                    {[
                      'What is my diagnosis?',
                      'Tell me about my medications',
                      'How long will recovery take?'
                    ].map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setChatInput(suggestion)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: '#4b5563',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#667eea'
                          e.currentTarget.style.background = '#f9fafb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb'
                          e.currentTarget.style.background = 'white'
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx}>
                      {/* Message Bubble */}
                      <div style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                      }}>
                        <div style={{
                          maxWidth: '75%',
                          padding: '1rem 1.25rem',
                          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: msg.role === 'user' 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : 'white',
                          color: msg.role === 'user' ? 'white' : '#1f2937',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                          fontSize: '0.95rem',
                          lineHeight: '1.6'
                        }}>
                          {msg.content}
                        </div>
                      </div>
                      
                      {/* Inline Video if present */}
                      {msg.videoUrl && (
                        <div style={{
                          marginTop: '1rem',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                          maxWidth: '75%'
                        }}>
                          <video 
                            controls 
                            style={{ 
                              width: '100%',
                              display: 'block'
                            }}
                            src={msg.videoUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                      
                      {/* Generate Video Button (for assistant messages without video) */}
                      {msg.role === 'assistant' && !msg.videoUrl && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            onClick={() => handleGenerateVideoFromChat(idx)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              border: 'none',
                              borderRadius: '8px',
                              color: 'white',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            <FiVideo size={16} />
                            Generate Video Explanation
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#6b7280' }}>
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: '#667eea',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }} />
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: '#667eea',
                        animation: 'pulse 1.5s ease-in-out 0.2s infinite'
                      }} />
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: '#667eea',
                        animation: 'pulse 1.5s ease-in-out 0.4s infinite'
                      }} />
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>AI is thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end'
            }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Ask a question about your health..."
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'none',
                    minHeight: '60px',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                style={{
                  padding: '1rem 1.5rem',
                  background: chatInput.trim() && !chatLoading 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : '#e5e7eb',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '60px'
                }}
                onMouseEnter={(e) => {
                  if (chatInput.trim() && !chatLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (chatInput.trim() && !chatLoading) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                <FiSend size={18} />
                Send
              </button>
            </div>
          </div>
        )}

        {/* Recovery Plan Tab */}
        {activeTab === 'recovery' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '700', 
                color: '#1f2937',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <FiCalendar size={28} color="#667eea" />
                30-Day Recovery Plan
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>
                Your personalized recovery milestones and educational videos
              </p>
              </div>

            {/* Recovery Timeline */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem'
            }}>
              {recoveryVideos.map((video, idx) => {
                const currentDay = getCurrentDay()
                const isUnlocked = video.day <= currentDay
                const isCurrent = video.day === currentDay
                
                return (
                  <div 
                    key={idx}
                    style={{
                      background: isUnlocked 
                        ? (isCurrent ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white')
                        : '#f9fafb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: isUnlocked ? '2px solid' : '2px dashed #d1d5db',
                      borderColor: isCurrent ? 'transparent' : (isUnlocked ? '#e5e7eb' : '#d1d5db'),
                      boxShadow: isUnlocked ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
                      opacity: isUnlocked ? 1 : 0.6,
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      color: isCurrent ? 'white' : '#1f2937'
                    }}
                    onMouseEnter={(e) => {
                      if (isUnlocked && !isCurrent) {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isUnlocked && !isCurrent) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                      }
                    }}
                  >
                    <div style={{ 
                      fontSize: '2rem', 
                      fontWeight: '800',
                      marginBottom: '0.75rem',
                      color: isCurrent ? 'white' : '#667eea'
                    }}>
                      Day {video.day}
                    </div>
                    <h3 style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '600',
                      marginBottom: '0.5rem',
                      color: isCurrent ? 'white' : '#1f2937'
                    }}>
                      {video.title}
                    </h3>
                    <p style={{ 
                      fontSize: '0.9rem',
                      color: isCurrent ? 'rgba(255, 255, 255, 0.9)' : '#6b7280',
                      lineHeight: '1.5',
                      marginBottom: '1rem'
                    }}>
                      {video.description}
                    </p>
                    {isUnlocked ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: isCurrent ? 'white' : '#667eea'
                      }}>
                        <FiVideo size={16} />
                        {isCurrent ? 'Watch Now' : 'Available'}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#9ca3af',
                        fontWeight: '600'
                      }}>
                        🔒 Unlocks Day {video.day}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress Bar */}
            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1f2937' }}>
                  Recovery Progress
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#667eea' }}>
                  Day {getCurrentDay()} of 30
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                background: '#e5e7eb',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(getCurrentDay() / 30) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default PatientProfile
