"""Initialize local database with realistic medical data for testing."""

import asyncio
import json
from app.services.database import LocalDatabase


async def init_sample_data():
  """Add comprehensive sample users and medical data to the database."""
  db = LocalDatabase("amma_health.db")
  await db.connect()

  try:
    # Insert multiple doctors with different specialties
    doctors = [
      {
        "email": "demo.doctor@amma.health",
        "first_name": "Dr. Sarah",
        "last_name": "Chen",
        "user_type": "doctor"
      },
      {
        "email": "cardio.doctor@amma.health",
        "first_name": "Dr. Michael",
        "last_name": "Rodriguez",
        "user_type": "doctor"
      },
      {
        "email": "neuro.doctor@amma.health",
        "first_name": "Dr. Priya",
        "last_name": "Sharma",
        "user_type": "doctor"
      },
      {
        "email": "ortho.doctor@amma.health",
        "first_name": "Dr. James",
        "last_name": "Thompson",
        "user_type": "doctor"
      }
    ]

    for doctor in doctors:
      try:
        await db.insert("users", doctor)
        print(f"✅ Added doctor: {doctor['email']}")
      except Exception as e:
        print(f"⚠️  Doctor {doctor['email']} may already exist: {e}")

    # Insert multiple patients with diverse conditions
    patients = [
      {
        "email": "anish.polakala@gmail.com",
        "first_name": "Anish",
        "last_name": "Polakala",
        "user_type": "patient"
      },
      {
        "email": "keisha.washington@email.com",
        "first_name": "Keisha",
        "last_name": "Washington",
        "user_type": "patient"
      },
      {
        "email": "mei.zhang@email.com",
        "first_name": "Mei Lin",
        "last_name": "Zhang",
        "user_type": "patient"
      },
      {
        "email": "jamal.thompson@email.com",
        "first_name": "Jamal",
        "last_name": "Thompson",
        "user_type": "patient"
      },
      {
        "email": "david.williams@email.com",
        "first_name": "David",
        "last_name": "Williams",
        "user_type": "patient"
      },
      {
        "email": "emily.rodriguez@email.com",
        "first_name": "Emily",
        "last_name": "Rodriguez",
        "user_type": "patient"
      }
    ]

    for patient in patients:
      try:
        await db.insert("users", patient)
        print(f"✅ Added patient: {patient['email']}")
      except Exception as e:
        print(f"⚠️  Patient {patient['email']} may already exist: {e}")

    # Insert comprehensive Epic patient data with realistic medical information
    epic_data = [
      {
        "doctor_email": "demo.doctor@amma.health",
        "patient_email": "anish.polakala@gmail.com",
        "epic_patient_id": "EPIC-001234",
        "epic_mrn": "MRN001234",
        "patient_name": "Anish Polakala",
        "patient_dob": "1990-01-15",
        "clinical_notes": "Patient presents for routine follow-up of Type 2 Diabetes Mellitus and Hypertension. Blood glucose levels well controlled with current medication regimen. Blood pressure readings stable at 128/82 mmHg. Patient reports good adherence to diet and exercise recommendations. Continue current medications. Recheck HbA1c in 3 months.",
        "diagnoses": json.dumps([
          {"display": "Type 2 Diabetes Mellitus without complications", "code": "E11.9", "clinicalStatus": "active"},
          {"display": "Essential (primary) hypertension", "code": "I10", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Metformin", "status": "active", "dosage": "500mg", "frequency": "Twice daily with meals", "route": "Oral"},
          {"name": "Lisinopril", "status": "active", "dosage": "10mg", "frequency": "Once daily", "route": "Oral"}
        ])
      },
      {
        "doctor_email": "demo.doctor@amma.health",
        "patient_email": "keisha.washington@email.com",
        "epic_patient_id": "EPIC-005678",
        "epic_mrn": "MRN005678",
        "patient_name": "Keisha Washington",
        "patient_dob": "1985-07-22",
        "clinical_notes": "Follow-up visit for persistent asthma. Patient reports improved symptom control with current inhaler regimen. Peak flow measurements show improvement. No recent exacerbations. Continue maintenance therapy. Patient educated on proper inhaler technique and trigger avoidance.",
        "diagnoses": json.dumps([
          {"display": "Mild persistent asthma, uncomplicated", "code": "J45.30", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Albuterol HFA", "status": "active", "dosage": "90mcg", "frequency": "2 puffs as needed for shortness of breath", "route": "Inhalation"},
          {"name": "Fluticasone propionate", "status": "active", "dosage": "110mcg", "frequency": "2 puffs twice daily", "route": "Inhalation"}
        ])
      },
      {
        "doctor_email": "demo.doctor@amma.health",
        "patient_email": "mei.zhang@email.com",
        "epic_patient_id": "EPIC-009876",
        "epic_mrn": "MRN009876",
        "patient_name": "Mei Lin Zhang",
        "patient_dob": "1992-11-08",
        "clinical_notes": "Patient returns for management of generalized anxiety disorder and insomnia. Reports significant improvement in anxiety symptoms with current medication. Sleep quality has improved. No significant side effects reported. Continue current treatment. Discussed stress management techniques and sleep hygiene.",
        "diagnoses": json.dumps([
          {"display": "Generalized anxiety disorder", "code": "F41.1", "clinicalStatus": "active"},
          {"display": "Insomnia, unspecified", "code": "G47.00", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Sertraline", "status": "active", "dosage": "50mg", "frequency": "Once daily in the morning", "route": "Oral"},
          {"name": "Trazodone", "status": "active", "dosage": "50mg", "frequency": "Once daily at bedtime as needed for sleep", "route": "Oral"}
        ])
      },
      {
        "doctor_email": "ortho.doctor@amma.health",
        "patient_email": "jamal.thompson@email.com",
        "epic_patient_id": "EPIC-004321",
        "epic_mrn": "MRN004321",
        "patient_name": "Jamal Thompson",
        "patient_dob": "1978-04-30",
        "clinical_notes": "Follow-up for osteoarthritis of the right knee. Patient reports moderate improvement with physical therapy and current medication. Pain level decreased from 7/10 to 4/10. Range of motion improved. Continue NSAID therapy and physical therapy exercises. Consider intra-articular injection if symptoms persist.",
        "diagnoses": json.dumps([
          {"display": "Osteoarthritis of right knee", "code": "M17.11", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Ibuprofen", "status": "active", "dosage": "400mg", "frequency": "Three times daily with food", "route": "Oral"},
          {"name": "Acetaminophen", "status": "active", "dosage": "500mg", "frequency": "As needed for pain, maximum 4 times daily", "route": "Oral"}
        ])
      },
      {
        "doctor_email": "cardio.doctor@amma.health",
        "patient_email": "david.williams@email.com",
        "epic_patient_id": "EPIC-007654",
        "epic_mrn": "MRN007654",
        "patient_name": "David Williams",
        "patient_dob": "1968-12-19",
        "clinical_notes": "Routine cardiology follow-up for coronary artery disease and hyperlipidemia. Patient is stable on current medications. Last echocardiogram showed preserved left ventricular function. Lipid panel shows LDL at target. Continue aggressive lipid management and antiplatelet therapy. Patient counseled on importance of medication adherence and lifestyle modifications.",
        "diagnoses": json.dumps([
          {"display": "Coronary artery disease, native coronary artery", "code": "I25.10", "clinicalStatus": "active"},
          {"display": "Hyperlipidemia, unspecified", "code": "E78.5", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Atorvastatin", "status": "active", "dosage": "40mg", "frequency": "Once daily at bedtime", "route": "Oral"},
          {"name": "Aspirin", "status": "active", "dosage": "81mg", "frequency": "Once daily", "route": "Oral"},
          {"name": "Metoprolol", "status": "active", "dosage": "25mg", "frequency": "Twice daily", "route": "Oral"}
        ])
      },
      {
        "doctor_email": "neuro.doctor@amma.health",
        "patient_email": "emily.rodriguez@email.com",
        "epic_patient_id": "EPIC-003456",
        "epic_mrn": "MRN003456",
        "patient_name": "Emily Rodriguez",
        "patient_dob": "1988-06-14",
        "clinical_notes": "Follow-up for migraine headaches. Patient reports reduction in frequency from 8-10 per month to 3-4 per month with current preventive medication. Acute attacks are well-controlled with abortive therapy. No significant side effects. Continue current regimen. Discussed trigger identification and lifestyle modifications.",
        "diagnoses": json.dumps([
          {"display": "Migraine without aura, not intractable", "code": "G43.909", "clinicalStatus": "active"}
        ]),
        "medications": json.dumps([
          {"name": "Propranolol", "status": "active", "dosage": "60mg", "frequency": "Twice daily", "route": "Oral"},
          {"name": "Sumatriptan", "status": "active", "dosage": "50mg", "frequency": "As needed at onset of migraine, maximum 2 per day", "route": "Oral"}
        ])
      }
    ]

    for data in epic_data:
      try:
        await db.insert("epic_patient_data", data)
        print(f"✅ Added Epic data for: {data['patient_name']}")
      except Exception as e:
        print(f"⚠️  Epic data for {data['patient_name']} may already exist: {e}")

    print("\n" + "="*60)
    print("✅ Database initialization completed successfully!")
    print("="*60)
    print("\n📊 Summary:")
    print(f"   - Doctors: {len(doctors)}")
    print(f"   - Patients: {len(patients)}")
    print(f"   - Medical Records: {len(epic_data)}")
    print("\n👨‍⚕️ Doctors:")
    for doc in doctors:
      print(f"   • {doc['first_name']} {doc['last_name']} ({doc['email']})")
    print("\n👤 Patients:")
    for pat in patients:
      print(f"   • {pat['first_name']} {pat['last_name']} ({pat['email']})")

  except Exception as e:
    print(f"\n❌ Error initializing data: {e}")
    import traceback
    traceback.print_exc()
  finally:
    await db.close()


if __name__ == "__main__":
  asyncio.run(init_sample_data())

