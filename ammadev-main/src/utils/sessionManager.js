import { supabase } from './supabaseClient'

// Generate a unique session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Create a new session in Supabase
export const createSession = async (email, name, userType, profilePicture = null) => {
  console.log('🔑 Creating session for:', { email, name, userType, profilePicture })
  
  const sessionId = generateSessionId()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // Session expires in 24 hours

  // Try with profile_picture first
  let sessionData = {
    session_id: sessionId,
    user_email: email,
    user_name: name,
    user_type: userType,
    profile_picture: profilePicture,
    expires_at: expiresAt.toISOString()
  }

  let { error } = await supabase
    .from('user_sessions')
    .insert([sessionData])

  // If error and it's about profile_picture column not existing, retry without it
  if (error && error.message?.includes('profile_picture')) {
    console.log('⚠️ profile_picture column not found, retrying without it...')
    const { session_id, user_email, user_name, user_type, expires_at } = sessionData
    const { error: retryError } = await supabase
      .from('user_sessions')
      .insert([{
        session_id,
        user_email,
        user_name,
        user_type,
        expires_at
      }])
    
    if (retryError) {
      console.error('❌ Error creating session (retry):', retryError)
      return null
    }
  } else if (error) {
    console.error('❌ Error creating session:', error)
    return null
  }

  // Store session ID in sessionStorage (not localStorage)
  sessionStorage.setItem('amma_session_id', sessionId)
  console.log('✅ Session stored in sessionStorage:', sessionId)
  return sessionId
}

// Get current session from Supabase
export const getCurrentSession = async () => {
  const sessionId = sessionStorage.getItem('amma_session_id')
  console.log('🔍 Getting session, ID from storage:', sessionId)
  
  if (!sessionId) {
    console.log('❌ No session ID in sessionStorage')
    return null
  }

  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error || !data) {
    console.log('❌ No active session found in Supabase:', error)
    sessionStorage.removeItem('amma_session_id')
    return null
  }

  // Check if session has expired
  const expiresAt = new Date(data.expires_at)
  if (expiresAt < new Date()) {
    console.log('❌ Session expired')
    await deleteSession(sessionId)
    return null
  }

  console.log('✅ Valid session found:', { email: data.user_email, name: data.user_name, type: data.user_type })
  return {
    email: data.user_email,
    name: data.user_name,
    userType: data.user_type,
    profilePicture: data.profile_picture
  }
}

// Delete session from Supabase
export const deleteSession = async (sessionId) => {
  if (!sessionId) {
    sessionId = sessionStorage.getItem('amma_session_id')
  }

  if (!sessionId) {
    return
  }

  await supabase
    .from('user_sessions')
    .delete()
    .eq('session_id', sessionId)

  sessionStorage.removeItem('amma_session_id')
}

// Logout - delete all sessions for user
export const logout = async () => {
  const session = await getCurrentSession()
  if (session) {
    // Delete all sessions for this user
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_email', session.email)
  }
  sessionStorage.removeItem('amma_session_id')
}

