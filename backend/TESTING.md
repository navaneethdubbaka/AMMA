# API Testing Guide

## Quick Test Examples

### 1. Basic Diagnosis Video (Diabetes & Hypertension)
```json
{
  "doctor_email": "demo.doctor@amma.health",
  "patient_email": "anish.polakala@gmail.com",
  "diagnosis_code": "E11.9",
  "procedure_code": "99213",
  "recovery_day": null,
  "recovery_milestone": null,
  "force_regenerate": false
}
```

### 2. Recovery Day 7 Video
```json
{
  "doctor_email": "demo.doctor@amma.health",
  "patient_email": "anish.polakala@gmail.com",
  "diagnosis_code": "E11.9",
  "procedure_code": "99213",
  "recovery_day": 7,
  "recovery_milestone": "Week 1 Diabetes Management Checkpoint",
  "force_regenerate": false
}
```

### 3. Asthma Patient Video
```json
{
  "doctor_email": "demo.doctor@amma.health",
  "patient_email": "keisha.washington@email.com",
  "diagnosis_code": "J45.30",
  "procedure_code": "99213",
  "recovery_day": null,
  "recovery_milestone": null,
  "force_regenerate": false
}
```

### 4. Anxiety & Insomnia Video
```json
{
  "doctor_email": "demo.doctor@amma.health",
  "patient_email": "mei.zhang@email.com",
  "diagnosis_code": "F41.1",
  "procedure_code": "99214",
  "recovery_day": null,
  "recovery_milestone": null,
  "force_regenerate": false
}
```

### 5. Osteoarthritis Recovery Day 14
```json
{
  "doctor_email": "ortho.doctor@amma.health",
  "patient_email": "jamal.thompson@email.com",
  "diagnosis_code": "M17.11",
  "procedure_code": "99213",
  "recovery_day": 14,
  "recovery_milestone": "Two-week mobility assessment",
  "force_regenerate": false
}
```

### 6. Coronary Artery Disease Video
```json
{
  "doctor_email": "cardio.doctor@amma.health",
  "patient_email": "david.williams@email.com",
  "diagnosis_code": "I25.10",
  "procedure_code": "99215",
  "recovery_day": null,
  "recovery_milestone": null,
  "force_regenerate": false
}
```

### 7. Migraine Recovery Day 21
```json
{
  "doctor_email": "neuro.doctor@amma.health",
  "patient_email": "emily.rodriguez@email.com",
  "diagnosis_code": "G43.909",
  "procedure_code": "99213",
  "recovery_day": 21,
  "recovery_milestone": "Three-week progress and independence",
  "force_regenerate": false
}
```

### 8. Force Regenerate (Skip Reuse)
```json
{
  "doctor_email": "demo.doctor@amma.health",
  "patient_email": "anish.polakala@gmail.com",
  "diagnosis_code": "E11.9",
  "procedure_code": "99213",
  "recovery_day": null,
  "recovery_milestone": null,
  "force_regenerate": true
}
```

## Testing with cURL

```bash
# Basic test
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_email": "demo.doctor@amma.health",
    "patient_email": "anish.polakala@gmail.com",
    "diagnosis_code": "E11.9",
    "procedure_code": "99213",
    "recovery_day": null,
    "recovery_milestone": null,
    "force_regenerate": false
  }'

# Using a JSON file
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d @test_payload_1.json
```

## Testing with Python

```python
import requests
import json

url = "http://localhost:8080/videos/generate"
payload = {
    "doctor_email": "demo.doctor@amma.health",
    "patient_email": "anish.polakala@gmail.com",
    "diagnosis_code": "E11.9",
    "procedure_code": "99213",
    "recovery_day": 7,
    "recovery_milestone": "Week 1 Diabetes Management Checkpoint",
    "force_regenerate": False
}

response = requests.post(url, json=payload)
print(response.json())
```

## Available Patients & Doctors

### Doctors
- `demo.doctor@amma.health` - Dr. Sarah Chen (Primary Care)
- `cardio.doctor@amma.health` - Dr. Michael Rodriguez (Cardiology)
- `neuro.doctor@amma.health` - Dr. Priya Sharma (Neurology)
- `ortho.doctor@amma.health` - Dr. James Thompson (Orthopedics)

### Patients
- `anish.polakala@gmail.com` - Type 2 Diabetes + Hypertension
- `keisha.washington@email.com` - Asthma
- `mei.zhang@email.com` - Anxiety + Insomnia
- `jamal.thompson@email.com` - Osteoarthritis
- `david.williams@email.com` - Coronary Artery Disease + Hyperlipidemia
- `emily.rodriguez@email.com` - Migraine

## Common ICD-10 Codes Used
- `E11.9` - Type 2 Diabetes Mellitus without complications
- `I10` - Essential (primary) hypertension
- `J45.30` - Mild persistent asthma
- `F41.1` - Generalized anxiety disorder
- `G47.00` - Insomnia, unspecified
- `M17.11` - Osteoarthritis of right knee
- `I25.10` - Coronary artery disease
- `E78.5` - Hyperlipidemia
- `G43.909` - Migraine without aura

## Common CPT Codes
- `99213` - Office visit, established patient (standard)
- `99214` - Office visit, established patient (moderate complexity)
- `99215` - Office visit, established patient (high complexity)

