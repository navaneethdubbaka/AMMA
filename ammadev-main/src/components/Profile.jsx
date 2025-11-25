import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import './Profile.css'

function Profile() {
  const navigate = useNavigate()
  const location = useLocation()
  const userName = location.state?.name || 'User'
  const userEmail = location.state?.email || ''
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('📧 User Data:', { userName, userEmail })
    if (!userEmail) {
      alert('⚠️ No email found! Please log in again.')
      navigate('/login')
      return
    }
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      // Try Supabase first
      const { data, error } = await supabase.from('user_notes').select('*').eq('email', userEmail).single()
      if (error) {
        console.warn('Supabase error - using localStorage fallback:', error.message)
        // Fallback to localStorage if Supabase fails
        const localNotes = localStorage.getItem(`notes_${userEmail}`)
        if (localNotes) setNotes(localNotes)
      } else if (data) {
        setNotes(data.notes || '')
      }
    } catch (error) {
      console.log('Loading from localStorage')
      const localNotes = localStorage.getItem(`notes_${userEmail}`)
      if (localNotes) setNotes(localNotes)
    }
    setLoading(false)
  }

  const saveNotes = async () => {
    console.log('Saving for:', userEmail)
    
    // Try Supabase first
    const { data, error } = await supabase.from('user_notes').upsert({ email: userEmail, name: userName, notes })
    
    if (error) {
      console.error('Supabase save error:', error)
      // Fallback to localStorage
      localStorage.setItem(`notes_${userEmail}`, notes)
      alert('⚠️ Saved locally (Supabase blocked)\n\nFix Supabase RLS to save to cloud!\nSee YOU_MUST_DO_THIS.md')
    }
    else {
      console.log('Saved to Supabase!')
      // Also save to localStorage as backup
      localStorage.setItem(`notes_${userEmail}`, notes)
      alert('Notes saved to cloud! ✅')
    }
  }

  const handleLogout = () => {
    navigate('/login')
  }

  if (loading) return <div className="profile-page"><div className="profile-container">Loading...</div></div>








  
  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-welcome">Welcome, {userName}! ❤️</h1>
        <p className="profile-subtitle">You're now logged in to Amma</p>
        
        <div style={{ margin: '30px 0' }}>
          <h3 style={{ marginBottom: '10px' }}>Your Notes:</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Type your notes here..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '15px',
              fontSize: '16px',
              borderRadius: '12px',
              border: '2px solid #ddd',
              fontFamily: 'inherit'
            }}
          />
          <button 
            onClick={saveNotes}
            style={{
              marginTop: '10px',
              padding: '12px 30px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Save Notes
          </button>
        </div>

        <div className="profile-actions">
          <button className="btn-primary" onClick={() => navigate('/')}>
            Go to Home
          </button>
          <button className="btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile

