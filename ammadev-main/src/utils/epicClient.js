/**
 * Epic FHIR API Client
 * Handles OAuth 2.0 authentication and FHIR API requests
 */

import { supabase } from './supabaseClient';
import { encrypt, decrypt } from './encryption';
import { 
  parsePatient, 
  parseConditions, 
  parseMedications, 
  parseDocuments,
  parseObservations,
  parseBundle
} from './fhirParser';

// Plasma FHIR Configuration from environment variables
// Plasma FHIR provides unified access to Epic and other EHR systems
const EPIC_CONFIG = {
  clientId: import.meta.env.VITE_EPIC_CLIENT_ID || '64b06556-5871-4703-a7c4-095821d64e36',
  redirectUri: import.meta.env.VITE_EPIC_REDIRECT_URI || 'http://localhost:5173/epic-callback',
  baseUrl: import.meta.env.VITE_EPIC_BASE_URL || 'https://api.plasma.health',
  authUrl: import.meta.env.VITE_EPIC_AUTH_URL || 'https://api.plasma.health/oauth2/authorize',
  tokenUrl: import.meta.env.VITE_EPIC_TOKEN_URL || 'https://api.plasma.health/oauth2/token',
  fhirApiBase: import.meta.env.VITE_EPIC_FHIR_API_BASE || 'https://api.plasma.health/fhir/r4',
  scopes: import.meta.env.VITE_EPIC_SCOPES || 'patient/*.read launch/patient openid fhirUser',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true' || false
};

/**
 * Initialize Epic OAuth flow (redirect to Epic authorization)
 * @param {string} doctorEmail - Doctor's email for state tracking
 * @returns {string|null} Authorization URL to redirect to, or null for demo mode
 */
export function initEpicAuth(doctorEmail) {
  // Demo mode: Skip OAuth, directly create connection
  if (EPIC_CONFIG.demoMode || doctorEmail === 'demo.doctor@amma.health') {
    console.log('🎭 Demo Mode: Skipping OAuth, creating demo connection');
    createDemoConnection(doctorEmail);
    return null; // Don't redirect
  }
  
  // Generate random state for CSRF protection
  const state = generateRandomState();
  
  // Store state in sessionStorage to verify callback
  sessionStorage.setItem('epic_oauth_state', state);
  sessionStorage.setItem('epic_oauth_doctor_email', doctorEmail);
  
  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: EPIC_CONFIG.clientId,
    redirect_uri: EPIC_CONFIG.redirectUri,
    scope: EPIC_CONFIG.scopes,
    state: state,
    aud: EPIC_CONFIG.fhirApiBase
  });
  
  const authUrl = `${EPIC_CONFIG.authUrl}?${params.toString()}`;
  
  console.log('🔐 Initiating Epic OAuth flow...');
  console.log('Authorization URL:', authUrl);
  
  return authUrl;
}

/**
 * Create demo connection without OAuth
 * @param {string} doctorEmail - Doctor's email
 */
async function createDemoConnection(doctorEmail) {
  try {
    // Create demo connection in database
    const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year
    
    const { error } = await supabase
      .from('epic_tokens')
      .upsert({
        doctor_email: doctorEmail,
        access_token: 'demo-token-' + Date.now(),
        refresh_token: 'demo-refresh-' + Date.now(),
        expires_at: expiresAt.toISOString(),
        epic_base_url: 'https://demo.plasma.health'
      }, {
        onConflict: 'doctor_email'
      });
    
    if (error) {
      console.error('Error creating demo connection:', error);
    } else {
      console.log('✅ Demo connection created');
      
      // Log audit event
      await logAuditEvent({
        doctor_email: doctorEmail,
        action: 'demo_connection_created',
        epic_resource_accessed: 'Demo Mode Connection'
      });
    }
  } catch (error) {
    console.error('Error in createDemoConnection:', error);
  }
}

/**
 * Handle OAuth callback (exchange code for tokens)
 * @param {string} code - Authorization code from Epic
 * @param {string} state - State parameter for CSRF verification
 * @returns {Promise<Object>} Token response
 */
export async function handleEpicCallback(code, state) {
  console.log('🔐 Handling Epic OAuth callback...');
  
  // Verify state (CSRF protection)
  const savedState = sessionStorage.getItem('epic_oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid OAuth state - possible CSRF attack');
  }
  
  const doctorEmail = sessionStorage.getItem('epic_oauth_doctor_email');
  if (!doctorEmail) {
    throw new Error('No doctor email found in session');
  }
  
  // Exchange authorization code for access token
  const tokenResponse = await fetch(EPIC_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: EPIC_CONFIG.redirectUri,
      client_id: EPIC_CONFIG.clientId
    })
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('❌ Token exchange failed:', error);
    throw new Error('Failed to exchange authorization code: ' + error);
  }
  
  const tokens = await tokenResponse.json();
  console.log('✅ Tokens received from Epic');
  
  // Calculate expiration time
  const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
  
  // Encrypt tokens before storing
  const encryptedAccessToken = await encrypt(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? 
    await encrypt(tokens.refresh_token) : null;
  
  // Store encrypted tokens in database
  const { error: dbError } = await supabase
    .from('epic_tokens')
    .upsert({
      doctor_email: doctorEmail,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt.toISOString(),
      epic_base_url: EPIC_CONFIG.fhirApiBase
    }, {
      onConflict: 'doctor_email'
    });
  
  if (dbError) {
    console.error('❌ Failed to store tokens:', dbError);
    throw new Error('Failed to store Epic tokens: ' + dbError.message);
  }
  
  // Log audit event
  await logAuditEvent({
    doctor_email: doctorEmail,
    action: 'epic_oauth_connected',
    epic_resource_accessed: 'OAuth Token'
  });
  
  // Clear session storage
  sessionStorage.removeItem('epic_oauth_state');
  sessionStorage.removeItem('epic_oauth_doctor_email');
  
  console.log('✅ Epic tokens stored securely');
  return { success: true, doctorEmail };
}

/**
 * Get Epic access token for a doctor (with auto-refresh)
 * @param {string} doctorEmail - Doctor's email
 * @returns {Promise<string>} Valid access token
 */
export async function getEpicToken(doctorEmail) {
  // Fetch token from database
  const { data, error } = await supabase
    .from('epic_tokens')
    .select('*')
    .eq('doctor_email', doctorEmail)
    .single();
  
  if (error || !data) {
    throw new Error('No Epic connection found. Please connect to Epic first.');
  }
  
  // Check if token is expired
  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  
  if (now >= expiresAt) {
    console.log('🔄 Token expired, refreshing...');
    return await refreshEpicToken(doctorEmail, data.refresh_token);
  }
  
  // Decrypt and return token
  const accessToken = await decrypt(data.access_token);
  return accessToken;
}

/**
 * Refresh Epic access token
 * @param {string} doctorEmail - Doctor's email
 * @param {string} encryptedRefreshToken - Encrypted refresh token
 * @returns {Promise<string>} New access token
 */
export async function refreshEpicToken(doctorEmail, encryptedRefreshToken) {
  if (!encryptedRefreshToken) {
    throw new Error('No refresh token available. Please reconnect to Epic.');
  }
  
  const refreshToken = await decrypt(encryptedRefreshToken);
  
  // Request new access token
  const tokenResponse = await fetch(EPIC_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: EPIC_CONFIG.clientId
    })
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('❌ Token refresh failed:', error);
    throw new Error('Failed to refresh Epic token. Please reconnect.');
  }
  
  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
  
  // Encrypt new tokens
  const encryptedAccessToken = await encrypt(tokens.access_token);
  const newEncryptedRefreshToken = tokens.refresh_token ? 
    await encrypt(tokens.refresh_token) : encryptedRefreshToken;
  
  // Update database
  const { error: dbError } = await supabase
    .from('epic_tokens')
    .update({
      access_token: encryptedAccessToken,
      refresh_token: newEncryptedRefreshToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('doctor_email', doctorEmail);
  
  if (dbError) {
    console.error('❌ Failed to update tokens:', dbError);
    throw new Error('Failed to store refreshed tokens');
  }
  
  // Log audit event
  await logAuditEvent({
    doctor_email: doctorEmail,
    action: 'epic_token_refreshed',
    epic_resource_accessed: 'OAuth Token'
  });
  
  console.log('✅ Epic token refreshed successfully');
  return await decrypt(encryptedAccessToken);
}

/**
 * Get demo patients for testing
 * @returns {Array} Array of demo patients
 */
function getDemoPatients() {
  return [
    {
      id: 'demo-patient-1',
      name: 'Anish Polakala',
      firstName: 'Anish',
      lastName: 'Polakala',
      gender: 'male',
      birthDate: '1992-08-15',
      age: new Date().getFullYear() - 1992,
      mrn: 'MRN001234',
      phone: '555-0100',
      email: 'anish.polakala@example.com',
      address: '123 Commonwealth Ave, Boston, MA 02116'
    },
    {
      id: 'demo-patient-2',
      name: 'Keisha Washington',
      firstName: 'Keisha',
      lastName: 'Washington',
      gender: 'female',
      birthDate: '1985-03-22',
      age: new Date().getFullYear() - 1985,
      mrn: 'MRN005678',
      phone: '555-0101',
      email: 'keisha.washington@example.com',
      address: '456 Blue Hill Ave, Boston, MA 02121'
    },
    {
      id: 'demo-patient-3',
      name: 'Mei Lin Zhang',
      firstName: 'Mei Lin',
      lastName: 'Zhang',
      gender: 'female',
      birthDate: '1990-11-08',
      age: new Date().getFullYear() - 1990,
      mrn: 'MRN009876',
      phone: '555-0102',
      email: 'meilin.zhang@example.com',
      address: '789 Beach St, Boston, MA 02111'
    },
    {
      id: 'demo-patient-4',
      name: 'Jamal Thompson',
      firstName: 'Jamal',
      lastName: 'Thompson',
      gender: 'male',
      birthDate: '1978-06-14',
      age: new Date().getFullYear() - 1978,
      mrn: 'MRN004321',
      phone: '555-0103',
      email: 'jamal.thompson@example.com',
      address: '321 Warren St, Boston, MA 02119'
    },
    {
      id: 'demo-patient-5',
      name: 'Priya Sharma',
      firstName: 'Priya',
      lastName: 'Sharma',
      gender: 'female',
      birthDate: '1988-12-19',
      age: new Date().getFullYear() - 1988,
      mrn: 'MRN007654',
      phone: '555-0104',
      email: 'priya.sharma@example.com',
      address: '567 Cambridge St, Boston, MA 02114'
    }
  ];
}

/**
 * Search for patients in Epic via Plasma FHIR
 * @param {string} doctorEmail - Doctor's email
 * @param {string} query - Patient name or MRN
 * @returns {Promise<Array>} Array of matching patients
 */
export async function searchEpicPatients(doctorEmail, query) {
  // Demo mode: return mock patients filtered by query
  if (EPIC_CONFIG.demoMode || doctorEmail === 'demo.doctor@amma.health') {
    console.log('🎭 Demo Mode: Returning mock patients');
    const demoPatients = getDemoPatients();
    
    // Filter by query if provided
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      const filtered = demoPatients.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.mrn.toLowerCase().includes(lowerQuery) ||
        p.email.toLowerCase().includes(lowerQuery)
      );
      return filtered;
    }
    
    return demoPatients;
  }
  
  const accessToken = await getEpicToken(doctorEmail);
  
  // Build search URL for Plasma FHIR
  const searchParams = new URLSearchParams({
    name: query,
    _count: 20
  });
  
  const searchUrl = `${EPIC_CONFIG.fhirApiBase}/Patient?${searchParams.toString()}`;
  
  console.log('🔍 Searching patients via Plasma FHIR:', query);
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Patient search failed:', error);
    throw new Error('Failed to search patients: ' + response.statusText);
  }
  
  const bundle = await response.json();
  
  // Parse patient resources
  const patients = bundle.entry?.map(entry => parsePatient(entry.resource)) || [];
  
  // Log audit event
  await logAuditEvent({
    doctor_email: doctorEmail,
    action: 'plasma_patient_search',
    epic_resource_accessed: 'Patient via Plasma FHIR'
  });
  
  console.log(`✅ Found ${patients.length} patients via Plasma FHIR`);
  return patients;
}

/**
 * Get demo patient data
 * @param {string} patientId - Demo patient ID
 * @returns {Object} Demo patient data
 */
function getDemoPatientData(patientId) {
  const demoPatients = {
    'demo-patient-1': {
      patient: getDemoPatients()[0],
      conditions: [
        { id: 'cond-1', display: 'Glioblastoma Multiforme, Right Frontal Lobe (C71.1)', clinicalStatus: 'active', onsetDate: '2024-08-15', category: 'Neoplasm/Oncology', severity: 'Grade IV (WHO), High-grade malignant glioma' },
        { id: 'cond-2', display: 'Cerebral Edema Secondary to Intracranial Mass (G93.6)', clinicalStatus: 'active', onsetDate: '2024-08-15', category: 'Neurological', severity: 'Moderate, controlled with steroids' },
        { id: 'cond-3', display: 'Seizure Disorder Secondary to Brain Tumor (G40.909)', clinicalStatus: 'active', onsetDate: '2024-08-20', category: 'Neurological', severity: 'Controlled on anticonvulsants' }
      ],
      medications: [
        { id: 'med-1', name: 'Temozolomide', status: 'active', dosage: '150mg/m² (280mg)', frequency: 'Once daily for 5 consecutive days every 28 days', route: 'Oral', prescribedDate: '2024-10-01', instructions: 'Chemotherapy agent. Take on empty stomach at bedtime. Concurrent with radiation therapy. Monitor CBC weekly. Anti-nausea medications prescribed as needed.' },
        { id: 'med-2', name: 'Dexamethasone', status: 'active', dosage: '4mg', frequency: 'Twice daily (morning & evening)', route: 'Oral', prescribedDate: '2024-08-20', instructions: 'Corticosteroid to reduce cerebral edema. Take with food to prevent GI upset. Do not abruptly discontinue. Monitor blood glucose. Taper as directed by oncology team.' },
        { id: 'med-3', name: 'Levetiracetam (Keppra)', status: 'active', dosage: '1000mg', frequency: 'Twice daily', route: 'Oral', prescribedDate: '2024-08-22', instructions: 'Anticonvulsant for seizure prophylaxis. May cause drowsiness - avoid driving until response known. Report mood changes, behavioral changes, or suicidal thoughts immediately.' },
        { id: 'med-4', name: 'Ondansetron (Zofran)', status: 'active', dosage: '8mg', frequency: 'Every 8 hours as needed for nausea', route: 'Oral', prescribedDate: '2024-10-01', instructions: 'Anti-nausea medication. Can be taken 30 minutes before meals if anticipating nausea from chemotherapy.' }
      ],
      documents: [
        { id: 'doc-1', type: 'Oncology Progress Note', date: '2024-11-18', author: 'Dr. Michael Rivera, MD - Neuro-Oncology', description: 'Post-operative follow-up. Patient tolerating chemoradiation protocol. Reviewing MRI findings.' },
        { id: 'doc-2', type: 'MRI Brain with Contrast', date: '2024-11-12', author: 'Dr. Patricia Lee, MD - Neuroradiology', description: 'Post-surgical baseline MRI showing expected post-operative changes. Residual enhancement in right frontal lobe. No new masses identified.' },
        { id: 'doc-3', type: 'Pathology Report', date: '2024-08-18', author: 'Dr. James Wu, MD - Neuropathology', description: 'Surgical specimen analysis confirms Glioblastoma Multiforme (WHO Grade IV). IDH-wildtype. MGMT promoter methylation status: Methylated (favorable prognostic indicator).' }
      ],
      observations: [
        { id: 'obs-1', display: 'Karnofsky Performance Status', value: '80', unit: 'score (0-100)', date: '2024-11-18', status: 'final', interpretation: 'Good functional status - able to carry on normal activity with effort' },
        { id: 'obs-2', display: 'White Blood Cell Count', value: '4.2', unit: 'K/uL', date: '2024-11-16', status: 'final', interpretation: 'Within normal range - adequate for chemotherapy continuation' },
        { id: 'obs-3', display: 'Absolute Neutrophil Count (ANC)', value: '2.8', unit: 'K/uL', date: '2024-11-16', status: 'final', interpretation: 'Adequate - no evidence of neutropenia' },
        { id: 'obs-4', display: 'Platelet Count', value: '195', unit: 'K/uL', date: '2024-11-16', status: 'final', interpretation: 'Normal - no bleeding risk' }
      ],
      clinical_notes: `PATIENT: Anish Polakala (MRN: MRN001234)
DATE OF VISIT: November 18, 2024
PROVIDER: Dr. Michael Rivera, MD - Neuro-Oncology
VISIT TYPE: Post-Operative Follow-Up - Glioblastoma Multiforme Management

CHIEF COMPLAINT:
Post-operative follow-up for newly diagnosed Glioblastoma Multiforme, right frontal lobe. Currently receiving concurrent chemoradiation therapy.

HISTORY OF PRESENT ILLNESS:
32-year-old male with recent diagnosis of Glioblastoma Multiforme (WHO Grade IV) of the right frontal lobe. Patient initially presented to emergency department on August 10, 2024 with new-onset seizure activity and progressive headaches over 2-week period. CT head revealed 4.2cm heterogeneous mass in right frontal lobe with significant surrounding edema and mild midline shift. MRI with contrast confirmed enhancing mass with central necrosis, concerning for high-grade glioma.

Patient underwent right frontal craniotomy with maximal safe resection on August 16, 2024 performed by Dr. Katherine Nguyen (Neurosurgery). Pathology confirmed Glioblastoma Multiforme, IDH-wildtype, with MGMT promoter methylation (favorable prognostic marker). Post-operative course complicated by transient left-sided weakness (resolved with PT) and one breakthrough seizure on post-op day 3.

Patient initiated Stupp Protocol on October 1, 2024: concurrent radiation therapy (60 Gy in 30 fractions) with daily temozolomide 75mg/m², followed by adjuvant temozolomide 150-200mg/m² days 1-5 of 28-day cycles. Currently in Cycle 1, Day 18 of adjuvant phase. Radiation therapy completed November 10, 2024.

CURRENT MEDICATIONS:
1. Temozolomide 280mg (150mg/m²) PO daily × 5 days every 28 days - chemotherapy
2. Dexamethasone 4mg PO BID - cerebral edema control
3. Levetiracetam (Keppra) 1000mg PO BID - seizure prophylaxis
4. Ondansetron 8mg PO Q8H PRN nausea
5. Pantoprazole 40mg PO daily - GI protection while on steroids

ALLERGIES: No Known Drug Allergies (NKDA)

REVIEW OF SYSTEMS:
Constitutional: Reports fatigue (expected from treatment), no fever. Weight stable at 165 lbs.
Neurological: No recurrent seizure activity since August. Mild persistent headaches controlled with acetaminophen. No new focal neurological deficits. Intact motor function bilaterally. Denies vision changes, ataxia, or vertigo.
Gastrointestinal: Mild nausea days 1-3 of chemotherapy cycle, well-controlled with ondansetron. Appetite fair. No vomiting or diarrhea.
Psychiatric: Mood stable but understandably anxious about diagnosis. Engaged with social work and support groups. No depression screening concerns.
Dermatologic: Mild facial puffiness from steroid use. Radiation dermatitis resolved.

PHYSICAL EXAMINATION:
Vitals: BP 118/76, HR 68, RR 14, Temp 98.4°F, Weight 165 lbs, O2 Sat 98% on room air
General: Alert, oriented x3, appears stated age, mild cushingoid features from steroid therapy
HEENT: Normocephalic. Well-healed right frontal craniotomy scar. No erythema or drainage at surgical site.
Neurological Examination:
  - Mental Status: Alert, fully oriented, appropriate affect, fluent speech
  - Cranial Nerves II-XII: Intact bilaterally
  - Motor: 5/5 strength all extremities, no pronator drift
  - Sensory: Intact to light touch and pinprick throughout
  - Reflexes: 2+ and symmetric, downgoing Babinski bilaterally
  - Coordination: Finger-to-nose intact, no dysmetria
  - Gait: Normal, steady, no ataxia
Cardiovascular: Regular rate and rhythm, no murmurs
Respiratory: Clear to auscultation bilaterally
Abdomen: Soft, non-tender, non-distended
Extremities: No cyanosis, clubbing, or edema

RECENT IMAGING - MRI Brain with Contrast (11/12/2024):
FINDINGS:
- Status post right frontal craniotomy with expected post-operative changes
- Minimal residual enhancement along resection cavity margins (stable from prior)
- Decreased surrounding FLAIR signal compared to immediate post-operative study
- No new enhancing lesions or masses identified
- No hydrocephalus or significant mass effect
- Ventricles and sulci normal in size and configuration
IMPRESSION: Expected post-surgical changes without evidence of tumor progression. Decreased vasogenic edema compared to prior study.

LABORATORY RESULTS (11/16/2024):
Complete Blood Count:
- WBC: 4.2 K/uL (reference: 4.5-11.0) - mild leukopenia acceptable
- Hemoglobin: 13.2 g/dL (reference: 13.5-17.5)
- Platelets: 195 K/uL (reference: 150-400)
- ANC: 2.8 K/uL (adequate for chemotherapy continuation)

Comprehensive Metabolic Panel:
- Sodium: 139 mEq/L, Potassium: 4.1 mEq/L, Chloride: 102 mEq/L
- BUN: 14 mg/dL, Creatinine: 0.9 mg/dL
- Glucose: 126 mg/dL (elevated due to steroid therapy - monitoring)
- ALT: 32 U/L, AST: 28 U/L - normal liver function
- Total Bilirubin: 0.6 mg/dL

ASSESSMENT AND PLAN:

PRIMARY DIAGNOSIS: GLIOBLASTOMA MULTIFORME (WHO GRADE IV), RIGHT FRONTAL LOBE
Status: Post-operative, currently receiving adjuvant chemotherapy (Cycle 1 of planned 6 cycles)

1. ONCOLOGIC MANAGEMENT
   • Patient tolerating Stupp Protocol reasonably well
   • Baseline post-radiation MRI shows stable disease, no progression
   • Continue temozolomide 280mg days 1-5 of 28-day cycle
   • MGMT methylation positive - favorable for temozolomide response
   • Karnofsky Performance Status: 80 (good functional status)
   • Plan: Continue current chemotherapy protocol for total of 6 cycles
   • Next MRI brain with contrast in 8 weeks (late January 2025)
   • Consider clinical trial enrollment if disease progression

2. CEREBRAL EDEMA - CONTROLLED
   • Dexamethasone 4mg BID effectively controlling symptoms
   • Begin steroid taper next week: reduce to 3mg BID × 1 week, then 2mg BID
   • Monitor for steroid-related complications (hyperglycemia, immunosuppression)
   • Continue PPI for GI protection

3. SEIZURE DISORDER SECONDARY TO BRAIN TUMOR - CONTROLLED
   • No seizure activity since initial presentation
   • Continue levetiracetam 1000mg BID
   • Maintain seizure precautions
   • State driving restrictions apply per neurology recommendations
   • Therapeutic drug monitoring not indicated at this time

4. SUPPORTIVE CARE
   • Nausea well-controlled with ondansetron
   • Encourage adequate hydration and nutrition
   • Fatigue expected from treatment - recommend energy conservation strategies
   • Continue physical therapy for conditioning
   • Social work engaged, support group recommended

5. MONITORING
   • CBC with differential weekly during chemotherapy weeks
   • CMP monthly to monitor glucose (steroid-induced hyperglycemia)
   • Pneumocystis jirovecii prophylaxis with TMP-SMX to be initiated given prolonged steroid use

PATIENT EDUCATION:
- Discussed MRI findings: stable post-operative changes, no evidence of tumor growth
- Reviewed expected chemotherapy side effects and when to call
- Emphasized importance of medication compliance, especially anti-seizure medication
- Driving restrictions discussed per state law (seizure within 6 months)
- Emergency contact information provided for fever, severe headache, new neurological symptoms, or uncontrolled nausea/vomiting
- Patient and family demonstrate good understanding of treatment plan
- Resources provided: American Brain Tumor Association, support groups

PROGNOSIS DISCUSSION:
Long discussion with patient and family regarding prognosis and treatment goals. Median survival for GBM with standard therapy is 15-18 months, but MGMT methylation status provides favorable prognostic indicator. Patient expresses realistic understanding and strong determination to pursue aggressive treatment. Emphasis on quality of life throughout treatment course. Palliative care consultation offered for symptom management - patient declines at this time but aware of availability.

FOLLOW-UP:
- Return to Neuro-Oncology clinic in 2 weeks (Cycle 2, Day 1 of chemotherapy)
- CBC with diff prior to next chemotherapy cycle
- MRI brain with contrast in 8 weeks
- Call immediately for fever > 100.4°F, severe headache, seizure, new weakness, or concerning symptoms
- Continue current medication regimen with planned steroid taper

ELECTRONICALLY SIGNED:
Dr. Michael Rivera, MD, FACP
Board Certified Medical Oncology & Neuro-Oncology
Massachusetts General Hospital Cancer Center
November 18, 2024 16:45 EST`
    },
    'demo-patient-2': {
      patient: getDemoPatients()[1],
      conditions: [
        { id: 'cond-4', display: 'Mild Persistent Asthma (J45.30)', clinicalStatus: 'active', onsetDate: '2010-03-15', category: 'Respiratory', severity: 'Mild-Moderate' },
        { id: 'cond-5', display: 'Seasonal Allergic Rhinitis (J30.2)', clinicalStatus: 'active', onsetDate: '2010-03-15', category: 'Allergic/Immunologic', severity: 'Mild' }
      ],
      medications: [
        { id: 'med-4', name: 'Albuterol Sulfate HFA Inhaler', status: 'active', dosage: '90mcg (2 puffs)', frequency: 'Every 4-6 hours as needed', route: 'Oral Inhalation', prescribedDate: '2024-06-20', instructions: 'Rescue inhaler for acute bronchospasm. Use 15 minutes before exercise. Seek emergency care if using more than 2x/week.' },
        { id: 'med-5', name: 'Fluticasone Propionate HFA', status: 'active', dosage: '110mcg (2 puffs)', frequency: 'Twice daily (morning & evening)', route: 'Oral Inhalation', prescribedDate: '2024-06-20', instructions: 'Controller medication - use daily even when feeling well. Rinse mouth after use to prevent thrush.' },
        { id: 'med-6', name: 'Montelukast Sodium', status: 'active', dosage: '10mg', frequency: 'Once daily at bedtime', route: 'Oral', prescribedDate: '2024-08-15', instructions: 'Leukotriene receptor antagonist for asthma control. Report mood changes.' }
      ],
      documents: [
        { id: 'doc-4', type: 'Pulmonology Follow-Up', date: '2024-11-10', author: 'Dr. Michael Rodriguez, MD', description: 'Asthma control assessment and spirometry results review.' },
        { id: 'doc-5', type: 'Spirometry Report', date: '2024-11-10', author: 'Pulmonary Function Lab', description: 'PFTs show mild obstruction, responsive to bronchodilator.' },
        { id: 'doc-6', type: 'Asthma Action Plan', date: '2024-11-10', author: 'Dr. Michael Rodriguez, MD', description: 'Updated action plan with green/yellow/red zone instructions.' }
      ],
      observations: [
        { id: 'obs-5', display: 'FEV1 (Forced Expiratory Volume)', value: '82', unit: '% predicted', date: '2024-11-10', status: 'final', interpretation: 'Mild obstruction, improved post-bronchodilator' },
        { id: 'obs-6', display: 'Peak Flow', value: '420', unit: 'L/min', date: '2024-11-10', status: 'final', interpretation: 'Personal best: 450 L/min - In green zone' },
        { id: 'obs-7', display: 'Oxygen Saturation', value: '98', unit: '%', date: '2024-11-10', status: 'final', interpretation: 'Normal' }
      ],
      clinical_notes: `PATIENT: Jane Doe (MRN: MRN005678)
DATE OF VISIT: November 10, 2024
PROVIDER: Dr. Michael Rodriguez, MD - Pulmonology
VISIT TYPE: Asthma Control Assessment & Spirometry

CHIEF COMPLAINT:
Follow-up for asthma management and seasonal allergy symptoms.

HISTORY OF PRESENT ILLNESS:
35-year-old female with mild persistent asthma (diagnosed 2010) presents for scheduled follow-up. Patient reports good overall asthma control on current regimen. Uses rescue inhaler approximately 1-2 times per week, primarily with exercise or during high pollen days. No nighttime awakenings in past month. No emergency department visits or oral steroid courses in past year. Patient compliant with controller medications. Reports seasonal rhinitis symptoms improving with addition of montelukast.

CURRENT MEDICATIONS:
1. Fluticasone Propionate 110mcg - 2 puffs BID (controller)
2. Albuterol Sulfate 90mcg - 2 puffs Q4-6H PRN (rescue)
3. Montelukast 10mg PO daily at bedtime

ALLERGIES: Penicillin (rash)

ASTHMA CONTROL QUESTIONNAIRE (ACQ) SCORE: 0.8 (Well controlled: < 1.5)

REVIEW OF SYSTEMS:
Respiratory: Occasional mild dyspnea with exertion. No chest tightness at rest.
ENT: Seasonal rhinorrhea and sneezing, improved with montelukast.
All other systems reviewed and negative.

PHYSICAL EXAMINATION:
Vitals: BP 118/76, HR 68, RR 14, SpO2 98% on room air, Temp 98.2°F
General: Alert, comfortable, speaking in full sentences
HEENT: Nasal mucosa slightly pale and boggy, consistent with allergic rhinitis
Neck: No lymphadenopathy, no stridor
Cardiovascular: Regular rate and rhythm, no murmurs
Respiratory: Good air entry bilaterally, no wheezes, crackles, or rhonchi
  - No accessory muscle use
  - No prolonged expiratory phase
Skin: No eczema or urticaria

SPIROMETRY RESULTS (11/10/2024):
Pre-bronchodilator:
- FEV1: 2.45 L (82% predicted)
- FVC: 3.18 L (91% predicted)
- FEV1/FVC ratio: 77%

Post-bronchodilator (after 4 puffs albuterol):
- FEV1: 2.78 L (93% predicted) - 13% improvement
- FVC: 3.25 L (93% predicted)
- Interpretation: Mild obstructive pattern with significant bronchodilator response

PEAK FLOW MONITORING:
- Current: 420 L/min
- Personal Best: 450 L/min
- Green Zone: > 360 L/min (80% of personal best)
- Yellow Zone: 270-360 L/min (50-80%)
- Red Zone: < 270 L/min (< 50%)

ASSESSMENT AND PLAN:

1. MILD PERSISTENT ASTHMA - WELL CONTROLLED
   • ACQ score 0.8 indicates good control
   • Spirometry shows mild obstruction with bronchodilator response
   • Continue current three-medication regimen
   • Fluticasone 110mcg BID - continue as controller
   • Albuterol PRN - using appropriately (< 2x/week)
   • Montelukast 10mg QHS - continue for dual benefit (asthma + allergies)
   • Patient demonstrates excellent inhaler technique
   • Updated Asthma Action Plan provided and reviewed

2. SEASONAL ALLERGIC RHINITIS - CONTROLLED
   • Symptoms improved with montelukast
   • May add intranasal corticosteroid if symptoms worsen during peak allergy season
   • Recommend environmental controls (keep windows closed during high pollen counts)

PATIENT EDUCATION:
- Reviewed proper inhaler technique with spacer
- Emphasized importance of daily controller medication (fluticasone) even when asymptomatic
- Discussed environmental triggers: pollen, dust, cold air, exercise
- When to escalate care: use of rescue inhaler > 2x/week, nighttime symptoms, decreased peak flow
- GREEN zone: current medications
- YELLOW zone: increase fluticasone to 220mcg BID, more frequent albuterol
- RED zone: seek immediate medical attention

FOLLOW-UP:
- Return in 6 months or sooner if control worsens
- Call office if rescue inhaler use increases to > 2x/week
- Continue home peak flow monitoring weekly
- Annual flu vaccine recommended (scheduled for next month)

ELECTRONICALLY SIGNED:
Dr. Michael Rodriguez, MD
Board Certified Pulmonary Medicine
November 10, 2024 11:15 PST`
    },
    'demo-patient-3': {
      patient: getDemoPatients()[2],
      conditions: [
        { id: 'cond-8', display: 'Generalized Anxiety Disorder (F41.1)', clinicalStatus: 'active', onsetDate: '2020-07-05', category: 'Mental Health', severity: 'Moderate, improving' },
        { id: 'cond-9', display: 'Insomnia Disorder (G47.00)', clinicalStatus: 'active', onsetDate: '2020-08-12', category: 'Sleep Disorder', severity: 'Mild' }
      ],
      medications: [
        { id: 'med-7', name: 'Sertraline HCl', status: 'active', dosage: '75mg', frequency: 'Once daily in morning', route: 'Oral', prescribedDate: '2023-09-01', instructions: 'SSRI for anxiety. Take with food. May cause initial nausea - usually resolves. Report increased anxiety or mood changes.' },
        { id: 'med-8', name: 'Hydroxyzine Pamoate', status: 'active', dosage: '25mg', frequency: 'At bedtime as needed', route: 'Oral', prescribedDate: '2024-02-10', instructions: 'For sleep and anxiety. May cause drowsiness - do not drive after taking. Maximum 3x per week.' }
      ],
      documents: [
        { id: 'doc-7', type: 'Psychiatric Follow-Up', date: '2024-10-20', author: 'Dr. Lisa Patel, MD', description: 'Patient reports 50% reduction in anxiety symptoms with current regimen.' },
        { id: 'doc-8', type: 'Therapy Progress Note', date: '2024-10-15', author: 'Amanda Chen, LCSW', description: 'CBT session #12. Patient demonstrating improved coping strategies.' }
      ],
      observations: [
        { id: 'obs-8', display: 'GAD-7 Score (Anxiety Assessment)', value: '8', unit: 'score', date: '2024-10-20', status: 'final', interpretation: 'Mild anxiety (score 5-9). Previously 15 (moderate). Significant improvement.' },
        { id: 'obs-9', display: 'PHQ-9 Score (Depression Screening)', value: '4', unit: 'score', date: '2024-10-20', status: 'final', interpretation: 'Minimal depression symptoms (score < 5). No concerning findings.' }
      ],
      clinical_notes: `PATIENT: Emily Johnson (MRN: MRN009876)
DATE OF VISIT: October 20, 2024
PROVIDER: Dr. Lisa Patel, MD - Psychiatry
VISIT TYPE: Psychiatric Follow-Up - Anxiety Management

CHIEF COMPLAINT: "I'm feeling much better but still have some anxiety."

HISTORY OF PRESENT ILLNESS:
28-year-old female with Generalized Anxiety Disorder and insomnia presents for follow-up. Patient started on sertraline 50mg 13 months ago, dose increased to 75mg 6 months ago with good response. Reports approximately 50% reduction in anxiety symptoms compared to initial presentation. Sleep has improved with combination of medication and sleep hygiene. Currently engaged in weekly cognitive behavioral therapy with LCSW. Patient reports fewer panic attacks (now 0-1 per month, previously 3-4 per week). Able to work full-time without significant impairment. Occasional breakthrough anxiety managed with hydroxyzine PRN.

CURRENT PSYCHIATRIC MEDICATIONS:
1. Sertraline 75mg PO daily in AM - SSRI for anxiety
2. Hydroxyzine 25mg PO QHS PRN insomnia/anxiety (using 2-3x/week)

PSYCHIATRIC REVIEW:
Mood: "Generally good, some ups and downs"
Affect: Bright, appropriate
Sleep: 6-7 hours per night, improved sleep latency
Appetite: Normal, no recent weight changes
Energy: Good during day
Concentration: Improved, able to focus at work
Anxiety: Reduced frequency and intensity
Panic attacks: 0-1 per month (down from 3-4 per week)
Suicidal ideation: Denies active/passive SI, no self-harm behaviors
Homicidal ideation: Denies

STANDARDIZED ASSESSMENTS:
GAD-7 Score: 8/21 (Mild anxiety)
- Previous score (4/2024): 15/21 (Moderate anxiety)
PHQ-9 Score: 4/27 (Minimal depression)
- Previous score (4/2024): 7/27 (Mild depression)

SUBSTANCE USE:
Alcohol: Social use, 1-2 drinks per week
Tobacco: Never smoker
Recreational drugs: Denies
Caffeine: 1-2 cups coffee daily

THERAPY ENGAGEMENT:
Currently in CBT with Amanda Chen, LCSW - weekly sessions
Progress: Good. Learning and applying coping strategies effectively
Homework compliance: Excellent

ASSESSMENT AND PLAN:

1. GENERALIZED ANXIETY DISORDER - SIGNIFICANTLY IMPROVED
   • GAD-7 score decreased from 15 to 8 (47% improvement)
   • Panic attacks markedly reduced
   • Functional improvement in work and social settings
   • Continue sertraline 75mg daily
   • Patient tolerating medication well, no side effects reported
   • Continue weekly CBT - consider transitioning to biweekly in 2-3 months if stability maintained

2. INSOMNIA - IMPROVED
   • Sleep hygiene practices implemented successfully
   • Hydroxyzine PRN effective when needed
   • Continue current regimen
   • Reinforce sleep hygiene: consistent schedule, screen time limits, relaxation techniques

PATIENT EDUCATION:
- Discussed importance of medication continuity even when feeling better
- Reviewed warning signs of relapse: increased worry, panic attacks, avoidance behaviors
- Encouraged continued therapy engagement
- Stress management: regular exercise, mindfulness practice
- Patient verbalizes understanding and agreement with plan

SAFETY ASSESSMENT:
Low risk: No SI/HI, good support system, engaged in treatment

FOLLOW-UP:
- Return in 3 months
- Continue weekly therapy
- Call if symptoms worsen or side effects develop
- Encouraged to use crisis resources if needed (988 Suicide & Crisis Lifeline)

ELECTRONICALLY SIGNED:
Dr. Lisa Patel, MD
Board Certified Psychiatry
October 20, 2024 15:45 PST`
    },
    'demo-patient-4': {
      patient: getDemoPatients()[3],
      conditions: [
        { id: 'cond-10', display: 'Osteoarthritis of Bilateral Knees (M17.0)', clinicalStatus: 'active', onsetDate: '2019-11-12', category: 'Musculoskeletal', severity: 'Moderate' },
        { id: 'cond-11', display: 'Obesity (E66.9)', clinicalStatus: 'active', onsetDate: '2015-01-10', category: 'Metabolic', severity: 'Class I (BMI 32.4)' }
      ],
      medications: [
        { id: 'med-9', name: 'Ibuprofen', status: 'active', dosage: '400mg', frequency: 'Three times daily with food', route: 'Oral', prescribedDate: '2023-03-10', instructions: 'NSAID for pain/inflammation. Take with food to reduce GI upset. Monitor for GI bleeding. Do not exceed 1200mg/day.' },
        { id: 'med-10', name: 'Glucosamine-Chondroitin', status: 'active', dosage: '1500mg-1200mg', frequency: 'Once daily', route: 'Oral', prescribedDate: '2024-01-15', instructions: 'Joint supplement. May take 2-3 months for effect. OTC supplement.' }
      ],
      documents: [
        { id: 'doc-9', type: 'Physical Therapy Progress Note', date: '2024-11-05', author: 'PT James Miller, DPT', description: 'Patient completing strengthening exercises. Improved quadriceps strength bilaterally.' },
        { id: 'doc-10', type: 'X-Ray Report - Bilateral Knees', date: '2024-09-20', author: 'Dr. Robert Kim, MD Radiology', description: 'Moderate joint space narrowing. Mild osteophyte formation. Consistent with osteoarthritis.' }
      ],
      observations: [
        { id: 'obs-10', display: 'Pain Scale (0-10)', value: '4', unit: 'out of 10', date: '2024-11-05', status: 'final', interpretation: 'Moderate pain, improved from baseline (was 7/10)' },
        { id: 'obs-11', display: 'BMI', value: '32.4', unit: 'kg/m²', date: '2024-11-05', status: 'final', interpretation: 'Class I Obesity - Weight loss recommended' }
      ],
      clinical_notes: `PATIENT: Robert Martinez (MRN: MRN011223)
DATE OF VISIT: November 5, 2024
PROVIDER: Dr. Amanda Foster, MD - Orthopedics
VISIT TYPE: Follow-Up - Osteoarthritis Management

CHIEF COMPLAINT: Bilateral knee pain, improving with physical therapy.

HISTORY OF PRESENT ILLNESS:
58-year-old male with bilateral knee osteoarthritis (diagnosed 2019) presents for follow-up. Patient has been compliant with physical therapy (2x/week for 8 weeks). Reports pain improved from 7/10 to 4/10 with combination of PT, NSAIDs, and activity modification. Still experiences stiffness after prolonged sitting and with stairs. Working on weight loss (down 8 lbs in 3 months). No mechanical symptoms (locking, catching). No swelling or erythema.

MEDICATIONS: Ibuprofen 400mg TID, Glucosamine-Chondroitin supplement

PHYSICAL EXAMINATION:
Bilateral Knees:
- Inspection: No effusion, erythema, or deformity
- Palpation: Mild tenderness over medial joint lines bilaterally
- Range of Motion: Flexion 0-125° (full), Extension 0° (full)
- Ligaments: ACL/PCL/MCL/LCL stable
- Meniscal Signs: Negative McMurray test
- Crepitus: Present with ROM, more pronounced left > right
- Gait: Antalgic gait, favoring left leg

X-RAY FINDINGS (9/20/2024):
Bilateral knees: Moderate joint space narrowing medial compartments. Mild osteophyte formation. Kellgren-Lawrence Grade 2-3.

ASSESSMENT: Bilateral knee osteoarthritis, moderate severity, improving with conservative management.

PLAN:
1. Continue ibuprofen 400mg TID with food
2. Continue PT - focusing on quadriceps strengthening, balance training
3. Weight loss goal: Additional 15-20 lbs over next 6 months
4. Consider intra-articular corticosteroid injection if pain plateaus
5. Knee braces for support during activity
6. Follow up 3 months - may consider hyaluronic acid injections if conservative management insufficient

ELECTRONICALLY SIGNED: Dr. Amanda Foster, MD - Orthopedics, November 5, 2024`
    },
    'demo-patient-5': {
      patient: getDemoPatients()[4],
      conditions: [
        { id: 'cond-12', display: 'Coronary Artery Disease - Status Post MI (I25.2)', clinicalStatus: 'active', onsetDate: '2021-08-30', category: 'Cardiovascular', severity: 'Stable, post-intervention' },
        { id: 'cond-13', display: 'Hyperlipidemia (E78.5)', clinicalStatus: 'active', onsetDate: '2020-01-10', category: 'Metabolic', severity: 'Controlled' },
        { id: 'cond-14', display: 'Hypertension (I10)', clinicalStatus: 'active', onsetDate: '2019-06-20', category: 'Cardiovascular', severity: 'Controlled' }
      ],
      medications: [
        { id: 'med-11', name: 'Atorvastatin Calcium', status: 'active', dosage: '80mg', frequency: 'Once daily at bedtime', route: 'Oral', prescribedDate: '2021-09-05', instructions: 'High-intensity statin post-MI. Target LDL < 70. Report muscle pain immediately.' },
        { id: 'med-12', name: 'Aspirin (Enteric Coated)', status: 'active', dosage: '81mg', frequency: 'Once daily with food', route: 'Oral', prescribedDate: '2021-09-05', instructions: 'Antiplatelet therapy post-MI. Take daily to prevent clotting. Report unusual bleeding.' },
        { id: 'med-13', name: 'Metoprolol Succinate ER', status: 'active', dosage: '50mg', frequency: 'Once daily in morning', route: 'Oral', prescribedDate: '2021-09-05', instructions: 'Beta blocker for heart rate/BP control. Do not stop abruptly. Monitor heart rate.' },
        { id: 'med-14', name: 'Lisinopril', status: 'active', dosage: '20mg', frequency: 'Once daily in morning', route: 'Oral', prescribedDate: '2021-09-05', instructions: 'ACE inhibitor for cardiac protection post-MI. Monitor kidney function and potassium.' }
      ],
      documents: [
        { id: 'doc-11', type: 'Cardiology Follow-Up', date: '2024-10-25', author: 'Dr. Thomas Wilson, MD', description: 'Post-MI surveillance. Patient stable on optimal medical therapy.' },
        { id: 'doc-12', type: 'Echocardiogram Report', date: '2024-10-15', author: 'Cardiology Imaging', description: 'LVEF 52%. Mild hypokinesis anterior wall. No significant valvular disease.' },
        { id: 'doc-13', type: 'Stress Test Report', date: '2024-10-20', author: 'Nuclear Cardiology', description: 'Exercise tolerance 9.2 METS. No inducible ischemia. Negative for angina.' }
      ],
      observations: [
        { id: 'obs-12', display: 'LDL Cholesterol', value: '65', unit: 'mg/dL', date: '2024-10-15', status: 'final', interpretation: 'At goal (< 70 mg/dL post-MI). Excellent control.' },
        { id: 'obs-13', display: 'Troponin I', value: '< 0.01', unit: 'ng/mL', date: '2024-10-15', status: 'final', interpretation: 'Negative. No evidence of acute cardiac injury.' },
        { id: 'obs-14', display: 'Blood Pressure', value: '122/78', unit: 'mmHg', date: '2024-10-25', status: 'final', interpretation: 'Optimal control' },
        { id: 'obs-15', display: 'Ejection Fraction (LVEF)', value: '52', unit: '%', date: '2024-10-15', status: 'final', interpretation: 'Normal (> 50%). Preserved systolic function.' }
      ],
      clinical_notes: `PATIENT: David Thompson (MRN: MRN013344)
DATE OF VISIT: October 25, 2024
PROVIDER: Dr. Thomas Wilson, MD - Cardiology
VISIT TYPE: Post-MI Follow-Up & Cardiac Risk Management

CHIEF COMPLAINT: Routine cardiology follow-up, feeling well.

HISTORY OF PRESENT ILLNESS:
62-year-old male with history of ST-elevation myocardial infarction (STEMI) in August 2021, status post PCI with drug-eluting stent to LAD. Patient presents for routine surveillance. Currently asymptomatic. No chest pain, shortness of breath, palpitations, or orthopnea. Exercise tolerance good - walks 2 miles daily without angina. Compliant with all cardiac medications. Recent stress test negative for ischemia. Echocardiogram shows preserved EF 52%. Successfully quit smoking post-MI (3+ years tobacco-free).

CARDIAC MEDICATIONS:
1. Atorvastatin 80mg PO QHS - high-intensity statin
2. Aspirin 81mg PO daily - antiplatelet therapy
3. Metoprolol Succinate 50mg PO daily - beta blocker
4. Lisinopril 20mg PO daily - ACE inhibitor

PAST MEDICAL HISTORY:
- CAD: STEMI 8/2021, PCI with DES to LAD
- Hypertension (controlled)
- Hyperlipidemia (controlled)
- Former smoker (quit 8/2021)

CARDIOVASCULAR REVIEW:
Chest pain: Denies
Shortness of breath: Denies
Palpitations: Denies
Syncope/Presyncope: Denies
Edema: Denies
Orthopnea/PND: Denies
Exercise tolerance: Excellent - 2 miles daily, no symptoms

RECENT TESTING:
Echocardiogram (10/15/2024):
- LVEF: 52% (normal)
- Regional wall motion: Mild hypokinesis anterior wall (consistent with old MI)
- Valves: No significant disease
- Pericardium: Normal

Exercise Stress Test with Nuclear Imaging (10/20/2024):
- Duration: 9.2 METS (good functional capacity)
- Peak HR: 132 bpm (83% maximum predicted)
- BP response: Appropriate
- No chest pain or significant ST changes
- Perfusion: No reversible defects, small fixed defect anterior (scar)
- Interpretation: NEGATIVE for inducible ischemia

Laboratory Results (10/15/2024):
- Lipid Panel:
  * Total Cholesterol: 142 mg/dL
  * LDL: 65 mg/dL (GOAL: < 70) ✓
  * HDL: 48 mg/dL
  * Triglycerides: 105 mg/dL
- Troponin I: < 0.01 ng/mL (negative)
- BNP: 45 pg/mL (normal)
- Creatinine: 0.9 mg/dL (normal renal function)
- Potassium: 4.1 mEq/L (normal)

PHYSICAL EXAMINATION:
Vitals: BP 122/78, HR 58 (on beta blocker), RR 14, SpO2 99%
General: Well-appearing, no distress
Cardiovascular: Regular rate and rhythm, no murmurs/rubs/gallops
  - No JVD
  - PMI non-displaced
  - Carotids: 2+ without bruits
  - Peripheral pulses: 2+ throughout, no edema
Lungs: Clear to auscultation bilaterally

ASSESSMENT:
1. CORONARY ARTERY DISEASE - STABLE, POST-MI
   • 3+ years post-STEMI with excellent recovery
   • Negative stress test - no evidence of recurrent ischemia
   • LVEF preserved at 52%
   • No anginal symptoms
   • Excellent functional capacity
   
2. HYPERLIPIDEMIA - OPTIMALLY CONTROLLED
   • LDL 65 mg/dL on atorvastatin 80mg (at goal < 70)
   • Continue high-intensity statin therapy indefinitely
   
3. HYPERTENSION - WELL CONTROLLED
   • BP 122/78 on dual therapy
   • Target < 130/80 achieved
   
4. CARDIOVASCULAR RISK REDUCTION - EXCELLENT COMPLIANCE
   • Tobacco cessation maintained (3+ years)
   • Daily aerobic exercise
   • Medication adherence 100%
   • Diet modifications implemented

PLAN:
1. Continue all current cardiac medications - no changes needed
2. Continue secondary prevention measures
3. Annual stress testing - next due October 2025
4. Annual echocardiogram - next due October 2025
5. Labs every 6 months (lipids, CMP)
6. Flu vaccine today - administered
7. Pneumococcal vaccine up to date

PATIENT EDUCATION:
- Reinforce medication importance - "medications for life"
- Continue daily exercise regimen
- Heart-healthy diet: low saturated fat, high fiber
- Warning signs of MI: chest pain, SOB, diaphoresis → Call 911
- Patient verbalizes excellent understanding

FOLLOW-UP: 6 months for routine visit. Call sooner if symptoms develop.

ELECTRONICALLY SIGNED:
Dr. Thomas Wilson, MD
Board Certified Cardiology
October 25, 2024 16:20 PST`
    }
  };
  
  return demoPatients[patientId] || demoPatients['demo-patient-1'];
}

/**
 * Fetch complete patient data from Epic via Plasma FHIR
 * @param {string} doctorEmail - Doctor's email
 * @param {string} epicPatientId - Epic patient ID
 * @returns {Promise<Object>} Complete patient data
 */
export async function fetchPatientData(doctorEmail, epicPatientId) {
  // Demo mode: return mock data
  if (EPIC_CONFIG.demoMode || doctorEmail === 'demo.doctor@amma.health' || epicPatientId.startsWith('demo-patient-')) {
    console.log('🎭 Demo Mode: Returning mock patient data');
    const demoData = getDemoPatientData(epicPatientId);
    
    // Store in database for consistency
    await storeEpicPatientData(doctorEmail, epicPatientId, demoData);
    
    // Log audit event
    await logAuditEvent({
      doctor_email: doctorEmail,
      epic_patient_id: epicPatientId,
      action: 'demo_patient_data_fetched',
      epic_resource_accessed: 'Demo Patient Data'
    });
    
    return demoData;
  }
  
  const accessToken = await getEpicToken(doctorEmail);
  
  console.log('📥 Fetching patient data via Plasma FHIR:', epicPatientId);
  
  // Fetch multiple resource types via Plasma FHIR
  const [patient, conditions, medications, documents, observations] = await Promise.all([
    fetchResource(accessToken, `Patient/${epicPatientId}`),
    fetchResourceBundle(accessToken, 'Condition', { patient: epicPatientId }),
    fetchResourceBundle(accessToken, 'MedicationRequest', { patient: epicPatientId }),
    fetchResourceBundle(accessToken, 'DocumentReference', { patient: epicPatientId }),
    fetchResourceBundle(accessToken, 'Observation', { patient: epicPatientId, category: 'laboratory' })
  ]);
  
  // Parse resources
  const parsedData = {
    patient: parsePatient(patient),
    conditions: parseConditions(conditions),
    medications: parseMedications(medications),
    documents: parseDocuments(documents),
    observations: parseObservations(observations)
  };
  
  // Store in database
  await storeEpicPatientData(doctorEmail, epicPatientId, parsedData);
  
  // Log audit event
  await logAuditEvent({
    doctor_email: doctorEmail,
    epic_patient_id: epicPatientId,
    action: 'plasma_patient_data_fetched',
    epic_resource_accessed: 'Patient, Condition, MedicationRequest, DocumentReference, Observation via Plasma FHIR'
  });
  
  console.log('✅ Patient data fetched via Plasma FHIR and stored');
  return parsedData;
}

/**
 * Fetch single FHIR resource
 * @param {string} accessToken - Epic access token
 * @param {string} resourcePath - Resource path (e.g., 'Patient/123')
 * @returns {Promise<Object>} FHIR resource
 */
async function fetchResource(accessToken, resourcePath) {
  const url = `${EPIC_CONFIG.fhirApiBase}/${resourcePath}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/fhir+json'
    }
  });
  
  if (!response.ok) {
    console.error(`❌ Failed to fetch ${resourcePath}:`, response.statusText);
    return null;
  }
  
  return await response.json();
}

/**
 * Fetch FHIR resource bundle (multiple resources)
 * @param {string} accessToken - Epic access token
 * @param {string} resourceType - Resource type (e.g., 'Condition')
 * @param {Object} params - Search parameters
 * @returns {Promise<Array>} Array of resources
 */
async function fetchResourceBundle(accessToken, resourceType, params) {
  const searchParams = new URLSearchParams(params);
  searchParams.append('_count', '50');
  
  const url = `${EPIC_CONFIG.fhirApiBase}/${resourceType}?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/fhir+json'
    }
  });
  
  if (!response.ok) {
    console.error(`❌ Failed to fetch ${resourceType}:`, response.statusText);
    return [];
  }
  
  const bundle = await response.json();
  return bundle.entry?.map(e => e.resource) || [];
}

/**
 * Store Epic patient data in database
 * @param {string} doctorEmail - Doctor's email
 * @param {string} epicPatientId - Epic patient ID
 * @param {Object} patientData - Parsed patient data
 */
async function storeEpicPatientData(doctorEmail, epicPatientId, patientData) {
  const { patient, conditions, medications, documents, observations } = patientData;
  
  const { error } = await supabase
    .from('epic_patient_data')
    .upsert({
      doctor_email: doctorEmail,
      epic_patient_id: epicPatientId,
      epic_mrn: patient.mrn,
      patient_name: patient.name,
      patient_dob: patient.birthDate,
      clinical_notes: generateClinicalNotesText(documents),
      diagnoses: JSON.stringify(conditions),
      medications: JSON.stringify(medications),
      last_synced: new Date().toISOString()
    }, {
      onConflict: 'doctor_email,epic_patient_id'
    });
  
  if (error) {
    console.error('❌ Failed to store Epic data:', error);
    throw new Error('Failed to store patient data: ' + error.message);
  }
}

/**
 * Get stored Epic patient data
 * @param {string} doctorEmail - Doctor's email
 * @param {string} epicPatientId - Epic patient ID
 * @returns {Promise<Object>} Stored patient data
 */
export async function getStoredEpicData(doctorEmail, epicPatientId) {
  const { data, error } = await supabase
    .from('epic_patient_data')
    .select('*')
    .eq('doctor_email', doctorEmail)
    .eq('epic_patient_id', epicPatientId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Parse JSON fields
  return {
    ...data,
    diagnoses: JSON.parse(data.diagnoses || '[]'),
    medications: JSON.parse(data.medications || '[]')
  };
}

/**
 * Check if doctor is connected to Epic
 * @param {string} doctorEmail - Doctor's email
 * @returns {Promise<boolean>} True if connected
 */
export async function isEpicConnected(doctorEmail) {
  const { data, error } = await supabase
    .from('epic_tokens')
    .select('id')
    .eq('doctor_email', doctorEmail)
    .single();
  
  return !error && !!data;
}

/**
 * Disconnect from Epic (delete tokens)
 * @param {string} doctorEmail - Doctor's email
 */
export async function disconnectEpic(doctorEmail) {
  const { error } = await supabase
    .from('epic_tokens')
    .delete()
    .eq('doctor_email', doctorEmail);
  
  if (error) {
    throw new Error('Failed to disconnect from Epic: ' + error.message);
  }
  
  // Log audit event
  await logAuditEvent({
    doctor_email: doctorEmail,
    action: 'epic_disconnected',
    epic_resource_accessed: 'OAuth Token'
  });
  
  console.log('✅ Disconnected from Epic');
}

// Helper Functions

function generateRandomState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateClinicalNotesText(documents) {
  if (!documents || documents.length === 0) return '';
  
  return documents.slice(0, 5).map(doc => 
    `${doc.type} (${doc.date}): ${doc.description || 'No description'}`
  ).join('\n');
}

/**
 * Log Epic audit event for HIPAA compliance
 * @param {Object} event - Audit event details
 */
async function logAuditEvent(event) {
  try {
    await supabase.from('epic_audit_log').insert({
      doctor_email: event.doctor_email,
      patient_email: event.patient_email || null,
      epic_patient_id: event.epic_patient_id || null,
      action: event.action,
      epic_resource_accessed: event.epic_resource_accessed || null,
      ip_address: null, // Would need server-side to capture real IP
      user_agent: navigator.userAgent
    });
  } catch (error) {
    console.error('❌ Failed to log audit event:', error);
    // Don't throw - audit logging failure shouldn't block operations
  }
}

export default {
  initEpicAuth,
  handleEpicCallback,
  getEpicToken,
  refreshEpicToken,
  searchEpicPatients,
  fetchPatientData,
  getStoredEpicData,
  isEpicConnected,
  disconnectEpic
};

