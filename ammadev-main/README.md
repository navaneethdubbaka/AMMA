# Amma Health - Medical Video Platform

A healthcare application that enables doctors to generate personalized medical explanation videos for patients using Epic EHR data and uploaded medical files.

## 🏥 Overview

Amma Health connects to Epic Systems via Plasma FHIR to pull patient medical data, allows doctors to upload additional files, and generates educational videos explaining diagnoses and treatment plans to patients.

### Key Features

- **Beta Access Modal**: Demo request form on login page to capture leads
- **Doctor Dashboard**: Manage patients, view roster, and add new patients
- **Patient Portal**: View personalized diagnosis videos, chat with AI assistant, and access recovery plans
- **Epic Integration**: Pull patient data from Epic EHR via Plasma FHIR
- **File Upload**: Upload PDFs, images, and scans with text extraction
- **AI Health Assistant**: Patient chatbot that answers questions based on medical data
- **30-Day Recovery Plan**: Scheduled milestone videos for patient follow-up
- **HIPAA Compliant**: Encrypted data storage and audit logging

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend/Database**: Supabase (PostgreSQL + Storage + Authentication)
- **Authentication**: Google OAuth
- **File Processing**: PDF.js for text extraction
- **FHIR API**: Plasma FHIR integration for Epic connectivity
- **Styling**: CSS with modern gradients and responsive design

## 📁 Project Structure

```
unicornwaitlist/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── Login.jsx       # Google OAuth login
│   │   ├── EpicConnect.jsx # Epic FHIR connection
│   │   └── Profile.jsx     # Base profile component
│   ├── pages/              # Main application pages
│   │   ├── DoctorProfile.jsx      # Doctor dashboard
│   │   ├── PatientProfile.jsx     # Patient portal
│   │   ├── PatientFilesPage.jsx   # File management & video generation
│   │   └── EpicCallbackPage.jsx   # OAuth callback handler
│   ├── utils/              # Utility functions
│   │   ├── supabaseClient.js  # Database client
│   │   ├── epicClient.js      # Epic/FHIR API client
│   │   ├── fhirParser.js      # FHIR data parsing
│   │   ├── fileExtractor.js   # PDF text extraction
│   │   ├── encryption.js      # Data encryption
│   │   ├── sessionManager.js  # User session management
│   │   └── keyGenerator.js    # Patient key generation
│   └── App.jsx             # Main app routing
├── public/
│   └── images/             # Static assets and demo video
├── setup/
│   └── sql/                # Database setup scripts
│       ├── COMPLETE_SUPABASE_SETUP.sql  # Main database schema
│       ├── DEMO_DOCTOR_SETUP.sql        # Demo account setup
│       ├── EPIC_INTEGRATION_SCHEMA.sql  # Epic integration tables
│       └── FINAL_DATABASE_SETUP.sql     # Complete setup script
├── docs/                   # Documentation
│   ├── EPIC_SETUP_GUIDE.md
│   └── HIPAA_COMPLIANCE.md
├── backend/                # FastAPI orchestrator for AI videos
│   ├── app/
│   └── requirements.txt
├── package.json
├── vite.config.js
└── index.html
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- Supabase account
- Google OAuth credentials
- Plasma FHIR API credentials (optional, demo mode available)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project at https://supabase.com
   - Go to SQL Editor and run: `setup/sql/FINAL_DATABASE_SETUP.sql`
   - Run: `setup/sql/DEMO_DOCTOR_SETUP.sql` (for demo data)

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   VITE_DEMO_MODE=true
   VITE_EPIC_CLIENT_ID=your_plasma_fhir_client_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   Open http://localhost:5173 in your browser

## 🔐 Authentication

### Demo Login

- **Doctor Account**: demo.doctor@amma.health
- **Patient Account**: Any Google account

### Google OAuth Setup

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:5173`
4. Use the Client ID in your `.env` file

## 🗄️ Database Schema

### Core Tables

- **`users`**: User accounts (doctors and patients)
- **`user_sessions`**: Active user sessions with JWT tokens
- **`doctor_patients`**: Doctor-patient relationships
- **`patient_files`**: Uploaded medical files with extracted text
- **`patient_videos`**: Generated video records
- **`epic_tokens`**: Encrypted Epic OAuth tokens
- **`epic_patient_data`**: Synced patient data from Epic
- **`epic_audit_log`**: HIPAA-compliant access logs

## 🏥 Epic Integration (Plasma FHIR)

### Demo Mode

By default, the app runs in demo mode with mock Epic data for 5 diverse patients:
- Anish Polakala (Brain Tumor - Glioblastoma)
- Keisha Washington (Asthma)
- Mei Lin Zhang (Anxiety/Insomnia)
- Jamal Thompson (Osteoarthritis)
- Priya Sharma (Coronary Artery Disease)

### Production Setup

1. Register at https://www.plasma.health
2. Obtain API credentials (Client ID)
3. Configure redirect URI in Plasma dashboard
4. Set `VITE_DEMO_MODE=false` in `.env`
5. Add your Plasma Client ID to `.env`

See `docs/EPIC_SETUP_GUIDE.md` for detailed instructions.

## 🎨 Key Features Explained

### For Doctors

1. **Connect to Epic**: OAuth flow to sync patient data from Epic EHR
2. **Add Patients**: Manually add patients or search Epic directory
3. **Upload Files**: Upload medical documents with automatic text extraction
4. **Generate Videos**: Create personalized explanation videos from medical data
5. **Patient Management**: View patient roster with profile pictures and basic info

### For Patients

1. **View Diagnosis Video**: Watch personalized medical explanation video
2. **AI Health Assistant**: Chat with AI to ask questions about their condition
3. **30-Day Recovery Plan**: Access scheduled milestone videos for recovery
4. **Patient Key**: Unique 9-digit code to share with doctors for access

## 🔧 Development

### Backend Service (FastAPI)

1. Install dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Create `backend/.env` using the keys described in `backend/README.md` (Supabase service key, Gemini API key/model, video provider endpoint/key, bucket name).
3. Start the service:
   ```bash
   uvicorn app.main:app --reload --port 8080
   ```
4. The frontend can call `POST http://localhost:8080/videos/generate` to trigger AI video creation; responses return the Supabase public video URL and metadata.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint Code

```bash
npm run lint
```

## 📦 Key Dependencies

- `react` & `react-dom` - UI framework
- `react-router-dom` - Client-side routing
- `@supabase/supabase-js` - Supabase client
- `pdfjs-dist` - PDF text extraction
- `jwt-decode` - JWT token decoding
- `react-icons` - Icon library

## 🔒 Security & Compliance

- OAuth 2.0 authentication
- Encrypted token storage
- Audit logging for all Epic data access
- Row Level Security (RLS) on Supabase tables
- HIPAA compliance considerations (see `docs/HIPAA_COMPLIANCE.md`)

## 📝 Notes for Development Agency

### Current State

- ✅ Fully functional demo mode with mock data
- ✅ Complete UI/UX for doctor and patient portals
- ✅ File upload and text extraction working
- ✅ Epic integration architecture in place
- ✅ Database schema complete with all necessary tables
- ⚠️ Video generation currently uses a demo video placeholder
- ⚠️ Production Epic connection needs real Plasma FHIR credentials

### Priority Tasks

1. **Video Generation**: Replace demo video with actual AI video generation API integration
2. **OCR Implementation**: Add OCR for image/scan text extraction (currently only PDFs work)
3. **Production Epic Testing**: Test with real Plasma FHIR credentials
4. **Mobile Responsiveness**: Enhance mobile UI/UX
5. **Performance Optimization**: Optimize large file uploads and video loading

### Environment Configuration

All sensitive configuration is in `.env` file (not committed to git). Make sure to:
- Keep Supabase keys secure
- Use environment-specific URLs for production
- Enable proper CORS settings in Supabase

## 📞 Support

For questions or issues, refer to:
- `docs/EPIC_SETUP_GUIDE.md` - Epic integration setup
- `docs/HIPAA_COMPLIANCE.md` - Compliance requirements
- Supabase documentation: https://supabase.com/docs
- Plasma FHIR documentation: https://docs.plasma.health

---

**Last Updated**: November 2024  
**Version**: 1.0.0

