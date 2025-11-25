import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import { supabase } from '../utils/supabaseClient'
import { createSession } from '../utils/sessionManager'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const [showBetaModal, setShowBetaModal] = useState(true)
  const [demoName, setDemoName] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoOrganization, setDemoOrganization] = useState('')
  const [demoSubmitting, setDemoSubmitting] = useState(false)
  
  const handleDemoRequest = async () => {
    if (!demoEmail || !demoName) {
      alert('Please enter your name and email')
      return
    }
    
    setDemoSubmitting(true)
    try {
      const { error } = await supabase
        .from('demo_requests')
        .insert([{
          name: demoName,
          email: demoEmail,
          organization: demoOrganization,
          requested_at: new Date().toISOString()
        }])
      
      if (error) {
        console.error('Error submitting demo request:', error)
        alert('Error submitting demo request. Please try again.')
      } else {
        alert('✅ Demo request submitted! We\'ll be in touch soon.')
        setShowBetaModal(false)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error submitting demo request.')
    } finally {
      setDemoSubmitting(false)
    }
  }
  
  const createOrUpdateUser = async (email, name, userType, profilePicture = null) => {
    try {
      console.log('🔐 Creating user:', { email, name, userType, profilePicture })
      
      const nameParts = name.split(' ')
      const firstName = nameParts[0] || name
      const lastName = nameParts.slice(1).join(' ') || nameParts[0]
      
      // Check if user exists
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      
      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking user:', selectError)
      }
      
      if (!existingUser) {
        console.log('📝 Creating new user...')
        
        // Generate patient key for new patients
        let patientKey = null
        if (userType === 'patient') {
          patientKey = Math.floor(100000000 + Math.random() * 900000000).toString()
          console.log('🔑 Generated patient key:', patientKey)
        }
        
        // Try to create user with profile_picture
        let userData = { 
          email, 
          first_name: firstName, 
          last_name: lastName, 
          user_type: userType,
          patient_key: patientKey,
          profile_picture: profilePicture
        }
        
        let { error } = await supabase
          .from('users')
          .insert([userData])
        
        // If error due to profile_picture column, retry without it
        if (error && error.message?.includes('profile_picture')) {
          console.log('⚠️ profile_picture column not found, creating user without it...')
          const { email: e, first_name, last_name, user_type, patient_key } = userData
          const { error: retryError } = await supabase
            .from('users')
            .insert([{ email: e, first_name, last_name, user_type, patient_key }])
          
          if (retryError) {
            console.error('❌ Error creating user (retry):', retryError)
            alert('Error creating account: ' + retryError.message)
            return false
          }
        } else if (error) {
          console.error('❌ Error creating user:', error)
          alert('Error creating account: ' + error.message)
          return false
        }
        console.log('✅ User created', profilePicture ? 'with profile picture' : '')
      } else {
        console.log('✅ User already exists')
        
        // Update profile picture if provided (backward compatible)
        if (profilePicture) {
          try {
            const { error: updateError } = await supabase
              .from('users')
              .update({ profile_picture: profilePicture })
              .eq('email', email)
            
            if (updateError && !updateError.message?.includes('profile_picture')) {
              console.error('⚠️ Error updating profile picture:', updateError)
            } else if (!updateError) {
              console.log('✅ Profile picture updated')
            }
          } catch (err) {
            console.log('⚠️ Could not update profile picture (column may not exist)')
          }
        }
        
        // Check if existing patient needs a patient_key
        if (userType === 'patient' && !existingUser.patient_key) {
          console.log('🔑 Existing patient missing patient_key, generating one...')
          const patientKey = Math.floor(100000000 + Math.random() * 900000000).toString()
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ patient_key: patientKey })
            .eq('email', email)
          
          if (updateError) {
            console.error('❌ Error updating patient_key:', updateError)
            // Don't fail login, but log the error
          } else {
            console.log('✅ Patient key generated and saved:', patientKey)
          }
        }
      }
      
      // Create session in Supabase
      console.log('🔑 Creating session...')
      const sessionId = await createSession(email, name, userType, profilePicture)
      if (!sessionId) {
        console.error('❌ Session creation failed')
        alert('Error creating session. Please try again.')
        return false
      }
      console.log('✅ Session created:', sessionId)
      
      return true
    } catch (error) {
      console.error('❌ Login error:', error)
      alert('Login failed: ' + error.message)
      return false
    }
  }




  return (
    <div className="login-page">
      {/* Beta Access Modal */}
      {showBetaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
            borderRadius: '24px',
            padding: '3rem 2.5rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            position: 'relative',
            animation: 'modalSlideIn 0.4s ease-out'
          }}>
            {/* Gradient accent bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 2px)',
              height: '6px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              borderRadius: '24px 24px 0 0'
            }} />
            
            {/* Logo */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
              border: '3px solid rgba(124, 58, 237, 0.2)'
            }}>
              <img 
                src="/images/Black Elephant Flat Illustrative Company Logo.png" 
                alt="Amma Logo" 
                style={{ 
                  width: '60px', 
                  height: '60px',
                  objectFit: 'contain'
                }} 
              />
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Beta Access Only
            </h2>

            {/* Message */}
            <p style={{
              fontSize: '1.125rem',
              color: '#64748b',
              textAlign: 'center',
              lineHeight: '1.7',
              marginBottom: '2rem'
            }}>
              We're currently in private beta with select healthcare providers.
              <br />
              <strong style={{ color: '#1f2937' }}>Launching publicly soon!</strong>
            </p>

            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem',
              padding: '1.5rem',
              background: 'rgba(124, 58, 237, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(124, 58, 237, 0.1)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>100+</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Clinicians</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>5000+</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Videos</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>50%</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Decrease in appointment lengths</div>
              </div>
            </div>

            {/* Demo Request Form */}
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Your Name *"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  marginBottom: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <input
                type="email"
                placeholder="Email Address *"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  marginBottom: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <input
                type="text"
                placeholder="Organization / Practice (optional)"
                value={demoOrganization}
                onChange={(e) => setDemoOrganization(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleDemoRequest}
                disabled={demoSubmitting}
                style={{
                  padding: '1rem 2rem',
                  background: demoSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: demoSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => !demoSubmitting && (e.target.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => !demoSubmitting && (e.target.style.transform = 'translateY(0)')}
              >
                {demoSubmitting ? 'Submitting...' : '📅 Request Demo Access'}
              </button>
              
              <button
                onClick={() => setShowBetaModal(false)}
                style={{
                  padding: '1rem 2rem',
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  color: '#64748b',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#7c3aed'
                  e.target.style.color = '#7c3aed'
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.color = '#64748b'
                }}
              >
                Continue to Login
              </button>
            </div>

            {/* Footer note */}
            <p style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              textAlign: 'center',
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #f0f0f0'
            }}>
              Interested in early access? Request a demo to learn more.
            </p>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div className="login-container">
        <h1 className="login-title">Welcome to Amma</h1>
        <p className="login-subtitle">Sign in or create an account to get started</p>

        <div className="login-options">
          <div className="login-section">
            <h2>I'm a Patient</h2>
            <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>Access your personalized health information</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const decoded = jwtDecode(credentialResponse.credential)
                  console.log('✅ Patient login successful:', {
                    email: decoded.email,
                    name: decoded.name,
                    picture: decoded.picture
                  })
                  const success = await createOrUpdateUser(decoded.email, decoded.name, 'patient', decoded.picture)
                  if (success) {
                    navigate('/patient')
                  }
                }}
                onError={() => {
                  console.error('❌ Google login failed')
                  alert('Login failed. Please try again.')
                }}
              />
            </div>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="login-section">
            <h2>I'm a Doctor</h2>
            <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>Manage your practice and patients</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const decoded = jwtDecode(credentialResponse.credential)
                  console.log('✅ Doctor login successful:', {
                    email: decoded.email,
                    name: decoded.name,
                    picture: decoded.picture
                  })
                  const success = await createOrUpdateUser(decoded.email, decoded.name, 'doctor', decoded.picture)
                  if (success) {
                    navigate('/doctor')
                  }
                }}
                onError={() => {
                  console.error('❌ Google login failed')
                  alert('Login failed. Please try again.')
                }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Login

