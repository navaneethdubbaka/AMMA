# Epic Systems Integration Setup Guide

## Overview

This guide walks you through setting up Epic FHIR API integration for Amma. Follow these steps to enable doctors to pull patient data from Epic EHR systems.

---

## Phase 1: Epic App Orchard Registration

### 1. Create an Epic Account

1. Go to [Epic App Orchard](https://apporchard.epic.com)
2. Click "Sign Up" and create an account
3. Verify your email address

### 2. Register Your Application

1. Log into App Orchard
2. Navigate to **"My Apps"** → **"Build a New App"**
3. Fill out the application form:
   - **App Name**: Amma - Patient Education Video Generator
   - **App Type**: Web Application
   - **Description**: AI-powered platform that generates personalized medical education videos from clinical notes
   - **Category**: Patient Engagement / Clinical Documentation
   - **SMART on FHIR**: Yes (Select this option)

### 3. Request FHIR API Access

Select the following SMART on FHIR scopes:

**Required Scopes:**
- `patient/Patient.read` - Patient demographics (name, DOB, MRN)
- `patient/Condition.read` - Diagnoses and conditions
- `patient/MedicationRequest.read` - Current medications and prescriptions
- `patient/DocumentReference.read` - Clinical notes and documentation
- `patient/Observation.read` - Lab results and vital signs (optional)

**Launch Context:**
- `launch` - Standalone app launch
- `openid` - OpenID Connect authentication
- `profile` - User profile information

### 4. Configure OAuth Settings

**Redirect URIs:**
- Development: `http://localhost:5173/epic-callback`
- Production: `https://your-domain.com/epic-callback`

**App Launch URL:**
- `https://your-domain.com/login`

### 5. Submit for Non-Production Access

1. Complete all required fields
2. Submit application for **non-production** access first
3. Wait for Epic approval email (typically 1-3 business days)

### 6. Receive Credentials

Once approved, you'll receive:
- **Client ID**: Your unique application identifier
- **Client Secret**: For confidential client authentication (optional)
- **Sandbox Base URL**: `https://fhir.epic.com/interconnect-fhir-oauth`

---

## Phase 2: Epic Sandbox Setup (For Testing)

### Using Epic's Public Sandbox

Epic provides a free public sandbox for testing without needing a real Epic account.

**Sandbox Details:**
- **Base URL**: `https://fhir.epic.com/interconnect-fhir-oauth`
- **Authorization Endpoint**: `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize`
- **Token Endpoint**: `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token`
- **FHIR API Base**: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

### Test Patients

Epic provides sample test patients you can use:

**Test Patient 1: Jason Fhir**
- **Patient ID**: `Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB`
- **Name**: Jason Argonaut
- **DOB**: 1985-08-01
- **MRN**: Multiple conditions, medications available

**Test Patient 2: Derrick Lin**
- **Patient ID**: `eg2N2disA3OQYaNdRSw4XxX0vu8Bb5FBoSJi3P7tqgLg3`
- **Name**: Derrick Lin
- **DOB**: 1993-04-13

### Getting Sandbox Credentials

1. Visit [Epic's FHIR Documentation](https://fhir.epic.com)
2. Navigate to **"SMART on FHIR"** → **"Test App"**
3. Use the provided Client ID for testing: `your-test-client-id`
4. No client secret needed for public clients

---

## Phase 3: Environment Configuration

### Create .env File

Create a `.env` file in your project root:

```env
# Epic FHIR Configuration
VITE_EPIC_CLIENT_ID=your_epic_client_id_here
VITE_EPIC_CLIENT_SECRET=your_epic_client_secret_here
VITE_EPIC_REDIRECT_URI=http://localhost:5173/epic-callback
VITE_EPIC_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth
VITE_EPIC_AUTH_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
VITE_EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
VITE_EPIC_FHIR_API_BASE=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4

# Encryption Key (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Epic Scopes
VITE_EPIC_SCOPES=patient/Patient.read patient/Condition.read patient/MedicationRequest.read patient/DocumentReference.read
```

### Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
openssl rand -base64 32
```

Copy the output into your `.env` file as `ENCRYPTION_KEY`.

---

## Phase 4: Database Setup

### Run SQL Scripts in Supabase

1. Log into your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run `setup/sql/EPIC_INTEGRATION_SCHEMA.sql`
4. Verify tables created successfully:
   - `epic_tokens`
   - `epic_patient_data`
   - `epic_audit_log`

---

## Phase 5: Testing the Integration

### Test OAuth Flow

1. Start your development server: `npm run dev`
2. Log in as a doctor
3. Click "Connect to Epic" button
4. You should be redirected to Epic's authorization page
5. Log in with sandbox credentials or use test patient
6. After authorization, you'll be redirected back to your app

### Test FHIR API Access

Once OAuth is complete:

1. Click "Pull from Epic" on a patient's page
2. Search for test patient: "Jason Argonaut"
3. Select patient and fetch data
4. Verify you can see:
   - Patient demographics
   - Diagnoses/conditions
   - Medications
   - Clinical notes

### Verify Data Storage

Check Supabase tables:

```sql
-- Check OAuth tokens stored
SELECT * FROM epic_tokens;

-- Check patient data pulled
SELECT * FROM epic_patient_data;

-- Check audit log
SELECT * FROM epic_audit_log;
```

---

## Phase 6: Production Deployment

### Prepare for Production Approval

Before submitting to Epic for production access:

1. **Complete Security Review**
   - Document HIPAA compliance measures
   - Provide encryption details
   - Show audit logging implementation

2. **Submit Production Application**
   - Update app profile with production URLs
   - Submit security questionnaire
   - Provide BAA documentation
   - Wait for Epic production approval (2-6 weeks)

3. **Update Environment Variables**
   - Change redirect URIs to production domains
   - Update base URLs if provided different production endpoints
   - Ensure encryption keys are secure

4. **HIPAA Compliance Checklist**
   - [ ] Business Associate Agreement (BAA) signed with Epic
   - [ ] BAA signed with Supabase (requires Pro plan)
   - [ ] Encryption at rest enabled
   - [ ] Audit logging implemented
   - [ ] Data retention policies configured
   - [ ] Access controls properly configured
   - [ ] Penetration testing completed

---

## Troubleshooting

### Common Issues

**Issue: "Invalid Client ID"**
- Verify your Client ID is correct in `.env`
- Ensure you're using non-production Client ID for sandbox testing

**Issue: "Redirect URI Mismatch"**
- Check that redirect URI in `.env` matches exactly what you registered in Epic
- Include protocol (http:// or https://)
- Check for trailing slashes

**Issue: "Insufficient Scopes"**
- Ensure you requested all required scopes during registration
- Verify scopes in your OAuth authorization request match approved scopes

**Issue: "Token Expired"**
- Implement token refresh logic using refresh token
- Check `expires_at` field in `epic_tokens` table
- Refresh tokens are valid for 90 days

**Issue: "FHIR Resource Not Found"**
- Verify patient ID is correct
- Check that patient exists in the Epic system you're connected to
- Ensure you have permission to access that resource type

### Debug Mode

Enable debug logging:

```javascript
// In epicClient.js
const DEBUG = true;

if (DEBUG) {
  console.log('Epic OAuth URL:', authUrl);
  console.log('Token Response:', tokenResponse);
  console.log('FHIR Response:', fhirData);
}
```

---

## Support & Resources

### Epic Documentation
- [Epic on FHIR](https://fhir.epic.com)
- [SMART on FHIR Docs](https://smarthealthit.org)
- [Epic App Orchard Support](https://apporchard.epic.com/Support)

### FHIR Resources
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [FHIR Patient Resource](https://hl7.org/fhir/R4/patient.html)
- [FHIR Condition Resource](https://hl7.org/fhir/R4/condition.html)

### Contact Epic Support
- Email: fhir@epic.com
- App Orchard Support Portal: https://apporchard.epic.com/Support

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Add `.env` to `.gitignore`
   - Use environment variables for all credentials

2. **Rotate encryption keys regularly**
   - Change encryption keys every 90 days
   - Re-encrypt stored tokens when rotating keys

3. **Monitor audit logs**
   - Review `epic_audit_log` table weekly
   - Set up alerts for suspicious activity

4. **Limit access**
   - Only doctors should have Epic connection capability
   - Patients should never see raw Epic data

5. **Data minimization**
   - Only pull data you actually need
   - Delete Epic data after 30 days (per retention policy)

---

## Next Steps

After completing this setup:

1. ✅ Test OAuth flow with Epic sandbox
2. ✅ Verify FHIR API data retrieval
3. ✅ Test video generation with Epic data
4. ✅ Complete HIPAA compliance documentation
5. ✅ Submit for Epic production approval
6. ✅ Deploy to production with proper security measures

For additional help, see `docs/HIPAA_COMPLIANCE.md` for compliance requirements.

