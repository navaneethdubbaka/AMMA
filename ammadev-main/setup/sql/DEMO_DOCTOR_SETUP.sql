-- ========================================
-- DEMO DOCTOR ACCOUNT SETUP
-- ========================================
-- Creates a demo doctor account for testing Plasma FHIR integration
-- Run this in Supabase SQL Editor

-- Create demo doctor user
INSERT INTO users (email, first_name, last_name, user_type)
VALUES 
  ('demo.doctor@amma.health', 'Dr. Demo', 'Physician', 'doctor')
ON CONFLICT (email) DO UPDATE
SET 
  first_name = 'Dr. Demo',
  last_name = 'Physician',
  user_type = 'doctor';

-- Create a demo session for the doctor (expires in 30 days)
INSERT INTO user_sessions (session_id, user_email, user_name, user_type, expires_at)
VALUES 
  ('demo-session-' || gen_random_uuid()::text, 
   'demo.doctor@amma.health', 
   'Dr. Demo Physician', 
   'doctor', 
   NOW() + INTERVAL '30 days')
ON CONFLICT (session_id) DO NOTHING;

-- Create demo Epic/Plasma FHIR connection
-- Note: This simulates a connected state for demo purposes
-- In demo mode, the app will return mock patient data
INSERT INTO epic_tokens (
  doctor_email, 
  access_token, 
  refresh_token, 
  expires_at, 
  epic_base_url
)
VALUES 
  ('demo.doctor@amma.health',
   'demo-access-token-encrypted',
   'demo-refresh-token-encrypted',
   NOW() + INTERVAL '365 days',
   'https://api.plasma.health')
ON CONFLICT (doctor_email) DO UPDATE
SET 
  access_token = 'demo-access-token-encrypted',
  refresh_token = 'demo-refresh-token-encrypted',
  expires_at = NOW() + INTERVAL '365 days',
  epic_base_url = 'https://api.plasma.health';

-- Add some demo patient data (5 patients)
INSERT INTO epic_patient_data (
  doctor_email,
  epic_patient_id,
  epic_mrn,
  patient_name,
  patient_dob,
  clinical_notes,
  diagnoses,
  medications,
  last_synced
)
VALUES 
  -- Patient 1: John Smith - Diabetes & Hypertension
  ('demo.doctor@amma.health', 'demo-patient-1', 'MRN001234', 'John Smith', '1975-03-15',
   'Routine follow-up. Blood sugar well controlled.',
   '[{"display": "Type 2 Diabetes Mellitus", "clinicalStatus": "active"}, {"display": "Hypertension", "clinicalStatus": "active"}]',
   '[{"name": "Metformin 500mg", "status": "active", "dosage": "500mg", "frequency": "Twice daily"}, {"name": "Lisinopril 10mg", "status": "active", "dosage": "10mg", "frequency": "Once daily"}]',
   NOW()),
   
  -- Patient 2: Sarah Johnson - Asthma
  ('demo.doctor@amma.health', 'demo-patient-2', 'MRN005678', 'Sarah Johnson', '1982-07-22',
   'Asthma well controlled with current medication.',
   '[{"display": "Asthma", "clinicalStatus": "active"}]',
   '[{"name": "Albuterol Inhaler", "status": "active", "dosage": "90mcg", "frequency": "As needed"}]',
   NOW()),
   
  -- Patient 3: Michael Chen - Anxiety
  ('demo.doctor@amma.health', 'demo-patient-3', 'MRN009876', 'Michael Chen', '1990-11-08',
   'Patient reports improved symptoms with medication.',
   '[{"display": "Anxiety Disorder", "clinicalStatus": "active"}]',
   '[{"name": "Sertraline 50mg", "status": "active", "dosage": "50mg", "frequency": "Once daily"}]',
   NOW()),
   
  -- Patient 4: Emily Rodriguez - Osteoarthritis
  ('demo.doctor@amma.health', 'demo-patient-4', 'MRN004321', 'Emily Rodriguez', '1988-04-30',
   'Patient progressing well with PT exercises.',
   '[{"display": "Osteoarthritis", "clinicalStatus": "active"}]',
   '[{"name": "Ibuprofen 400mg", "status": "active", "dosage": "400mg", "frequency": "Three times daily"}]',
   NOW()),
   
  -- Patient 5: David Williams - CAD & Hyperlipidemia
  ('demo.doctor@amma.health', 'demo-patient-5', 'MRN007654', 'David Williams', '1968-12-19',
   'Stable cardiac status. Continue current medications.',
   '[{"display": "Coronary Artery Disease", "clinicalStatus": "active"}, {"display": "Hyperlipidemia", "clinicalStatus": "active"}]',
   '[{"name": "Atorvastatin 40mg", "status": "active", "dosage": "40mg", "frequency": "Once daily"}, {"name": "Aspirin 81mg", "status": "active", "dosage": "81mg", "frequency": "Once daily"}]',
   NOW())
ON CONFLICT (doctor_email, epic_patient_id) DO UPDATE
SET 
  patient_name = EXCLUDED.patient_name,
  patient_dob = EXCLUDED.patient_dob,
  clinical_notes = EXCLUDED.clinical_notes,
  diagnoses = EXCLUDED.diagnoses,
  medications = EXCLUDED.medications,
  last_synced = NOW();

-- Log demo setup in audit log
INSERT INTO epic_audit_log (
  doctor_email,
  action,
  epic_resource_accessed
)
VALUES 
  ('demo.doctor@amma.health', 'demo_account_setup', 'Demo data initialized');

-- ========================================
-- VERIFICATION
-- ========================================

-- Check demo doctor exists
SELECT * FROM users WHERE email = 'demo.doctor@amma.health';

-- Check demo connection
SELECT 
  doctor_email, 
  epic_base_url, 
  expires_at 
FROM epic_tokens 
WHERE doctor_email = 'demo.doctor@amma.health';

-- Check demo patients
SELECT 
  epic_patient_id,
  patient_name,
  epic_mrn,
  patient_dob
FROM epic_patient_data
WHERE doctor_email = 'demo.doctor@amma.health'
ORDER BY patient_name;

-- Show summary
SELECT 
  'Demo Doctor' as setup_component,
  COUNT(*) as count
FROM users 
WHERE email = 'demo.doctor@amma.health'
UNION ALL
SELECT 
  'Demo Patients',
  COUNT(*)
FROM epic_patient_data
WHERE doctor_email = 'demo.doctor@amma.health'
UNION ALL
SELECT 
  'Demo Connection',
  COUNT(*)
FROM epic_tokens
WHERE doctor_email = 'demo.doctor@amma.health';

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Demo Doctor Account Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Login Credentials:';
  RAISE NOTICE '  Email: demo.doctor@amma.health';
  RAISE NOTICE '  Name: Dr. Demo Physician';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Features:';
  RAISE NOTICE '  - 5 demo patients with realistic medical data';
  RAISE NOTICE '  - Pre-connected to Plasma FHIR (demo mode)';
  RAISE NOTICE '  - No real Epic connection needed for testing';
  RAISE NOTICE '';
  RAISE NOTICE 'To use demo account:';
  RAISE NOTICE '  1. Log in with demo.doctor@amma.health';
  RAISE NOTICE '  2. Click "Pull from Epic" on any patient';
  RAISE NOTICE '  3. Search for patients (John, Sarah, Michael, Emily, David)';
  RAISE NOTICE '  4. Select patient to view their data';
  RAISE NOTICE '  5. Generate videos with their clinical information';
END $$;

