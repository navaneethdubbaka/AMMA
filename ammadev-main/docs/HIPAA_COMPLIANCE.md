# HIPAA Compliance Documentation

## Overview

This document outlines HIPAA compliance measures implemented in Amma for Epic Systems integration and Protected Health Information (PHI) handling.

---

## Compliance Requirements Checklist

### ✅ Administrative Safeguards

- [x] **Business Associate Agreements (BAA)**
  - Required with Epic (via App Orchard agreement)
  - Required with Supabase (requires Pro plan: https://supabase.com/docs/guides/platform/going-into-prod#going-into-production)
  - Required with hosting provider (if applicable)
  
- [x] **Access Controls**
  - Role-based access: Doctors can access Epic, patients cannot
  - Session management with expiration
  - User authentication via Google OAuth
  
- [x] **Audit Logging**
  - All Epic data access logged in `epic_audit_log` table
  - Includes: doctor email, patient ID, action, timestamp, resource accessed
  - Logs stored for 90 days minimum

- [x] **Data Retention Policies**
  - Epic patient data auto-deleted after 30 days
  - Audit logs retained for 90 days
  - Automated cleanup via `cleanup_old_epic_data()` function

### ✅ Technical Safeguards

- [x] **Encryption at Rest**
  - OAuth tokens encrypted with AES-256-GCM before database storage
  - Encryption key stored in environment variable (not in code)
  - Supabase database encryption (requires Pro plan)
  
- [x] **Encryption in Transit**
  - All API calls use HTTPS/TLS 1.2+
  - Epic FHIR API enforces TLS
  - Supabase connections use SSL
  
- [x] **Access Logging**
  - Audit trail of all data access
  - User agent and timestamp captured
  - Action types logged: OAuth connect/disconnect, patient search, data fetch

- [x] **Secure Authentication**
  - OAuth 2.0 for Epic integration (industry standard)
  - State parameter for CSRF protection
  - Token refresh mechanism for expired credentials

### ✅ Physical Safeguards

- [ ] **Data Center Security**
  - Supabase: AWS data centers with SOC 2 Type II compliance
  - Epic: Cloud-based infrastructure with physical security
  
- [ ] **Disaster Recovery**
  - Database backups (Supabase automatic backups)
  - Point-in-Time Recovery enabled (requires Pro plan)

---

## Implementation Details

### 1. Data Encryption

**Token Encryption:**
```javascript
// src/utils/encryption.js
- Uses Web Crypto API
- AES-256-GCM encryption
- Random 12-byte IV per encryption
- Base64 encoded storage format
```

**Encryption Key Management:**
- 32-byte encryption key generated via: `openssl rand -base64 32`
- Stored in `.env` file as `ENCRYPTION_KEY`
- Never committed to version control
- Rotated every 90 days (manual process)

**Database-Level Encryption:**
- Supabase Pro plan includes encryption at rest
- All tables encrypted: `epic_tokens`, `epic_patient_data`, `epic_audit_log`

### 2. Audit Logging

**What We Log:**
- Epic OAuth connection/disconnection
- Patient searches in Epic
- Patient data fetches from Epic FHIR API
- Token refresh events
- Any Epic resource access

**Audit Log Schema:**
```sql
CREATE TABLE epic_audit_log (
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
```

**Audit Log Retention:**
- Logs kept for 90 days
- Auto-cleanup via scheduled job
- Can be exported for compliance reporting

### 3. Access Controls

**Role-Based Access:**
- Only doctors can connect to Epic
- Patients never see raw Epic data
- Session-based authentication with expiration
- Database RLS policies can be enabled for production

**Epic OAuth Scopes:**
- `patient/Patient.read` - Patient demographics only
- `patient/Condition.read` - Diagnoses (read-only)
- `patient/MedicationRequest.read` - Medications (read-only)
- `patient/DocumentReference.read` - Clinical notes (read-only)
- No write access to Epic data

### 4. Data Minimization

**Only Pull Necessary Data:**
- Patient demographics (name, DOB, MRN)
- Active diagnoses/conditions
- Current medications
- Recent clinical notes (last 5 visits)
- No full medical history pulled

**Data Storage:**
- Epic data stored temporarily (30 days max)
- Auto-cleanup removes old data
- Only store what's needed for video generation

### 5. Secure Data Transmission

**API Communications:**
- Epic FHIR API: HTTPS only
- Supabase API: TLS 1.2+
- OAuth tokens transmitted securely
- No PHI in URL parameters

### 6. Incident Response Plan

**In Case of Data Breach:**

1. **Immediate Actions (0-24 hours)**
   - Identify and contain the breach
   - Disconnect affected systems
   - Revoke all Epic OAuth tokens
   - Document breach details

2. **Notification Requirements (within 60 days)**
   - Notify affected patients
   - Notify Epic Systems
   - Notify HHS Office for Civil Rights
   - File breach report

3. **Post-Incident Review**
   - Conduct root cause analysis
   - Implement corrective measures
   - Update security policies
   - Retrain staff

**Breach Contact:**
- Email: security@yourdomain.com
- Phone: (XXX) XXX-XXXX

---

## Supabase Configuration for HIPAA

### Required Steps:

1. **Upgrade to Supabase Pro Plan**
   - Navigate to: https://supabase.com/dashboard/project/_/settings/billing
   - Minimum: Pro plan ($25/month)
   - Required for: BAA, encryption at rest, Point-in-Time Recovery

2. **Sign BAA with Supabase**
   - Contact Supabase support: support@supabase.io
   - Request HIPAA BAA
   - Complete and sign agreement

3. **Enable Security Features**
   ```
   - Database encryption at rest: Enabled by default on Pro
   - SSL/TLS connections: Enforced
   - Point-in-Time Recovery: Enable in dashboard
   - Automatic backups: Configured
   ```

4. **Configure RLS Policies** (Production)
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE epic_tokens ENABLE ROW LEVEL SECURITY;
   ALTER TABLE epic_patient_data ENABLE ROW LEVEL SECURITY;
   ALTER TABLE epic_audit_log ENABLE ROW LEVEL SECURITY;
   
   -- Create policies for doctors only
   CREATE POLICY "Doctors can access their own Epic tokens"
     ON epic_tokens FOR ALL
     USING (doctor_email = current_user_email());
   ```

---

## Epic App Orchard Compliance

### Security Review Requirements:

1. **Application Security Questionnaire**
   - Completed during production approval
   - Covers encryption, authentication, data handling
   - Epic reviews before approval

2. **Penetration Testing**
   - Required for production approval
   - Third-party security assessment
   - Results submitted to Epic

3. **Epic BAA**
   - Automatic with App Orchard production approval
   - Covers FHIR API data transmission
   - Annual renewal required

---

## Ongoing Compliance Maintenance

### Monthly Tasks:

- [ ] Review audit logs for suspicious activity
- [ ] Verify encryption key security
- [ ] Check data retention compliance
- [ ] Review user access logs

### Quarterly Tasks:

- [ ] Run security vulnerability scans
- [ ] Review and update access controls
- [ ] Test backup and recovery procedures
- [ ] Review Epic token expiration logs

### Annual Tasks:

- [ ] Renew Epic BAA
- [ ] Renew Supabase BAA
- [ ] Rotate encryption keys
- [ ] Conduct HIPAA security assessment
- [ ] Update privacy policies
- [ ] Staff HIPAA training

---

## Data Subject Rights (Patient Rights)

Patients have the right to:

1. **Access Their Data**
   - Patients can view data through patient portal
   - Epic data not directly exposed to patients
   - Request data export via doctor

2. **Correct Their Data**
   - Corrections made in Epic, not in Amma
   - Amma pulls updated data on next sync

3. **Delete Their Data**
   - Patient can request account deletion
   - Epic data auto-deleted after 30 days
   - Manual deletion available via doctor

4. **Data Portability**
   - Export available in JSON format
   - Includes all patient files and generated videos
   - Does not include Epic-sourced data (managed by Epic)

---

## Compliance Verification

### Testing Encryption:

```javascript
// Test encryption is working
import { testEncryption } from './src/utils/encryption.js';

const result = await testEncryption();
console.log('Encryption test:', result ? 'PASS' : 'FAIL');
```

### Verify Audit Logging:

```sql
-- Check recent Epic access
SELECT 
  doctor_email,
  action,
  epic_resource_accessed,
  timestamp
FROM epic_audit_log
ORDER BY timestamp DESC
LIMIT 50;

-- Check for unusual patterns
SELECT 
  doctor_email,
  COUNT(*) as access_count,
  COUNT(DISTINCT epic_patient_id) as unique_patients
FROM epic_audit_log
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY doctor_email
ORDER BY access_count DESC;
```

### Check Data Retention:

```sql
-- Verify old data is being cleaned up
SELECT 
  COUNT(*) as old_records,
  MAX(last_synced) as oldest_sync
FROM epic_patient_data
WHERE last_synced < NOW() - INTERVAL '30 days';

-- Should return 0 if cleanup is working
```

---

## Risk Assessment

### High Risk Areas:

1. **Epic OAuth Tokens**
   - Risk: Token theft/exposure
   - Mitigation: AES-256 encryption, auto-expiration, secure storage

2. **Patient Data in Database**
   - Risk: Database breach
   - Mitigation: Encryption at rest, access controls, audit logging

3. **Data in Transit**
   - Risk: Man-in-the-middle attacks
   - Mitigation: TLS 1.2+, certificate validation

4. **User Authentication**
   - Risk: Unauthorized access
   - Mitigation: OAuth 2.0, session management, CSRF protection

### Medium Risk Areas:

1. **Browser Storage**
   - Risk: XSS attacks accessing sessionStorage
   - Mitigation: Limited use of sessionStorage, CSP headers

2. **API Rate Limiting**
   - Risk: Excessive data pulls
   - Mitigation: Epic enforces rate limits, audit logging tracks usage

---

## Recommended Security Enhancements

### Future Improvements:

1. **Multi-Factor Authentication (MFA)**
   - Add MFA for doctor accounts
   - Require MFA for Epic connection

2. **IP Whitelisting**
   - Restrict Epic access to known IPs
   - Implement geographic restrictions

3. **Advanced Threat Detection**
   - Implement anomaly detection in audit logs
   - Alert on unusual access patterns

4. **Enhanced Encryption**
   - Add field-level encryption for sensitive data
   - Implement key rotation automation

5. **Security Monitoring**
   - Integrate SIEM solution
   - Real-time alerting for security events

---

## Compliance Contacts

**HIPAA Privacy Officer:**
- Name: [To be assigned]
- Email: privacy@yourdomain.com
- Phone: (XXX) XXX-XXXX

**HIPAA Security Officer:**
- Name: [To be assigned]
- Email: security@yourdomain.com
- Phone: (XXX) XXX-XXXX

**Epic Support:**
- Email: fhir@epic.com
- App Orchard Support: https://apporchard.epic.com/Support

**Supabase Support:**
- Email: support@supabase.io
- HIPAA/BAA inquiries: enterprise@supabase.io

---

## Certification and Training

### Required Training:

1. **All Staff:**
   - HIPAA Privacy Rule training (annually)
   - Security awareness training (annually)
   - Incident response procedures

2. **Developers:**
   - Secure coding practices
   - PHI handling procedures
   - Epic FHIR API security

3. **Administrators:**
   - Access control management
   - Audit log review procedures
   - Breach response protocols

### Recommended Certifications:

- HIPAA Compliance Officer (HCO)
- Certified in Healthcare Privacy and Security (CHPS)
- Certified Information Systems Security Professional (CISSP)

---

## Additional Resources

- [HHS HIPAA for Professionals](https://www.hhs.gov/hipaa/for-professionals/index.html)
- [Epic FHIR Security Documentation](https://fhir.epic.com/Documentation?docId=oauth2)
- [Supabase HIPAA Compliance](https://supabase.com/docs/guides/platform/hipaa)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Attestation

This documentation represents the current HIPAA compliance implementation as of [Date].

**Last Updated:** [Date]  
**Reviewed By:** [Name, Title]  
**Next Review Date:** [Date + 1 year]

