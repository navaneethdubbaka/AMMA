-- ========================================
-- COMPLETE SUPABASE SETUP - PASTE THIS ENTIRE SCRIPT
-- ========================================

-- Step 1: Delete ALL old tables
DROP TABLE IF EXISTS patient_files CASCADE;
DROP TABLE IF EXISTS doctor_patients CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_notes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Step 2: Create users table
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('patient', 'doctor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create doctor_patients table
CREATE TABLE doctor_patients (
  id SERIAL PRIMARY KEY,
  doctor_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  patient_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  patient_name TEXT,
  patient_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_email, patient_email)
);

-- Step 4: Create patient_files table (FOR FILE UPLOADS & VIDEOS)
CREATE TABLE patient_files (
  id SERIAL PRIMARY KEY,
  doctor_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  patient_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('file', 'video')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  case_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4.5: Create user_sessions table (FOR SESSION MANAGEMENT)
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: DISABLE Row Level Security
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;

-- Step 6: Grant full permissions to anon and authenticated users
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;
GRANT ALL ON doctor_patients TO anon;
GRANT ALL ON doctor_patients TO authenticated;
GRANT ALL ON patient_files TO anon;
GRANT ALL ON patient_files TO authenticated;
GRANT ALL ON user_sessions TO anon;
GRANT ALL ON user_sessions TO authenticated;

-- Step 7: Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE doctor_patients_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE doctor_patients_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE patient_files_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE patient_files_id_seq TO authenticated;

-- Step 8: Add test data
INSERT INTO users (email, first_name, last_name, user_type) 
VALUES 
  ('patient1@test.com', 'John', 'Doe', 'patient'),
  ('doctor1@test.com', 'Jane', 'Smith', 'doctor')
ON CONFLICT (email) DO NOTHING;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check RLS is disabled
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity = false THEN '✅ RLS DISABLED'
    ELSE '❌ RLS ENABLED (Bad!)'
  END as status
FROM pg_tables 
WHERE tablename IN ('users', 'doctor_patients', 'patient_files', 'user_sessions')
ORDER BY tablename;

-- View all tables
SELECT * FROM users;
SELECT * FROM doctor_patients;
SELECT * FROM patient_files;
SELECT * FROM user_sessions;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
-- You should see:
-- 1. Four tables with "✅ RLS DISABLED"
-- 2. Two test users
-- 3. Empty doctor_patients, patient_files, and user_sessions tables
-- ========================================
