-- ========================================
-- EPIC SYSTEMS INTEGRATION SCHEMA
-- ========================================
-- This script creates tables for Epic FHIR integration
-- Run this in Supabase SQL Editor after COMPLETE_SUPABASE_SETUP.sql

-- Table 1: Store encrypted OAuth tokens for Epic access
CREATE TABLE IF NOT EXISTS epic_tokens (
  id SERIAL PRIMARY KEY,
  doctor_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  epic_base_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_email)
);

-- Table 2: Store patient data pulled from Epic FHIR API
CREATE TABLE IF NOT EXISTS epic_patient_data (
  id SERIAL PRIMARY KEY,
  doctor_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  patient_email TEXT REFERENCES users(email) ON DELETE CASCADE,
  epic_patient_id TEXT NOT NULL,
  epic_mrn TEXT,
  patient_name TEXT,
  patient_dob DATE,
  clinical_notes TEXT,
  diagnoses JSONB,
  medications JSONB,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_email, epic_patient_id)
);

-- Table 3: Audit log for HIPAA compliance
CREATE TABLE IF NOT EXISTS epic_audit_log (
  id SERIAL PRIMARY KEY,
  doctor_email TEXT NOT NULL,
  patient_email TEXT,
  epic_patient_id TEXT,
  action TEXT NOT NULL,
  epic_resource_accessed TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for development (enable in production with proper policies)
ALTER TABLE epic_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE epic_patient_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE epic_audit_log DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON epic_tokens TO anon;
GRANT ALL ON epic_tokens TO authenticated;
GRANT ALL ON epic_patient_data TO anon;
GRANT ALL ON epic_patient_data TO authenticated;
GRANT ALL ON epic_audit_log TO anon;
GRANT ALL ON epic_audit_log TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE epic_tokens_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE epic_tokens_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE epic_patient_data_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE epic_patient_data_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE epic_audit_log_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE epic_audit_log_id_seq TO authenticated;

-- Create function to cleanup old Epic data (30 day retention)
CREATE OR REPLACE FUNCTION cleanup_old_epic_data()
RETURNS void AS $$
BEGIN
  -- Delete Epic patient data older than 30 days
  DELETE FROM epic_patient_data
  WHERE last_synced < NOW() - INTERVAL '30 days';
  
  -- Delete audit logs older than 90 days
  DELETE FROM epic_audit_log
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_epic_tokens_doctor ON epic_tokens(doctor_email);
CREATE INDEX IF NOT EXISTS idx_epic_patient_data_doctor ON epic_patient_data(doctor_email);
CREATE INDEX IF NOT EXISTS idx_epic_patient_data_epic_id ON epic_patient_data(epic_patient_id);
CREATE INDEX IF NOT EXISTS idx_epic_audit_log_doctor ON epic_audit_log(doctor_email);
CREATE INDEX IF NOT EXISTS idx_epic_audit_log_timestamp ON epic_audit_log(timestamp);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check tables created
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity = false THEN '✅ RLS DISABLED'
    ELSE '❌ RLS ENABLED'
  END as status
FROM pg_tables 
WHERE tablename IN ('epic_tokens', 'epic_patient_data', 'epic_audit_log')
ORDER BY tablename;

-- View structure
SELECT 'epic_tokens' as table_name, COUNT(*) as row_count FROM epic_tokens
UNION ALL
SELECT 'epic_patient_data', COUNT(*) FROM epic_patient_data
UNION ALL
SELECT 'epic_audit_log', COUNT(*) FROM epic_audit_log;

