# Quick Setup Guide for Development Agency

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Create Environment File

Create a `.env` file in the root directory with these variables:

```env
# Supabase Configuration (Get from https://supabase.com/dashboard)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google OAuth (Get from https://console.cloud.google.com)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# Demo Mode (Set to 'true' for development)
VITE_DEMO_MODE=true

# Epic/Plasma FHIR (Optional - only needed for production)
VITE_EPIC_CLIENT_ID=your_plasma_fhir_client_id
```

## Step 3: Set Up Supabase Database

1. Create a free Supabase account at https://supabase.com
2. Create a new project
3. Go to **SQL Editor** in the left sidebar
4. Copy and paste the contents of `setup/sql/FINAL_DATABASE_SETUP.sql`
5. Click **Run** to execute the script
6. (Optional) Run `setup/sql/DEMO_DOCTOR_SETUP.sql` to create demo accounts
7. Run `setup/sql/CREATE_DEMO_REQUESTS_TABLE.sql` to enable beta access form

## Step 4: Configure Google OAuth

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:5173`
   - Add your production domain later
7. Copy the **Client ID** and paste into `.env` file

## Step 5: Run the Application

```bash
npm run dev
```

The app will open at http://localhost:5173

## Step 6: Test with Demo Account

### Login as Doctor:
- Click "Login with Google"
- Use email: `demo.doctor@amma.health` (or any Google account)
- You'll see the doctor dashboard

### Login as Patient:
- Use any Google account
- You'll see the patient portal
- Get your 9-digit patient key from the top-right corner
- Share this key with a doctor to connect

## Key Files to Review

### Core Application Files:
- `src/App.jsx` - Main routing and app structure
- `src/pages/DoctorProfile.jsx` - Doctor dashboard
- `src/pages/PatientProfile.jsx` - Patient portal with AI chat
- `src/pages/PatientFilesPage.jsx` - File management and video generation

### API Integration:
- `src/utils/supabaseClient.js` - Database client
- `src/utils/epicClient.js` - Epic FHIR integration (currently in demo mode)
- `src/utils/fileExtractor.js` - PDF text extraction

### Database:
- `setup/sql/FINAL_DATABASE_SETUP.sql` - Complete schema
- See README.md for table descriptions

## Demo Mode

The app includes demo mode with 5 realistic patients:
- **Anish Polakala** - Brain tumor (Glioblastoma)
- **Keisha Washington** - Asthma
- **Mei Lin Zhang** - Anxiety/Insomnia
- **Jamal Thompson** - Osteoarthritis
- **Priya Sharma** - Coronary Artery Disease

When logged in as demo doctor, click **"Pull from Plasma FHIR"** to load mock Epic data.

## Known Limitations

1. **Video Generation**: Currently uses a placeholder demo video (`public/images/20251121_0810_01kakjqdsse5jb6f3mdz9p3j0t.mp4`)
   - Need to integrate actual AI video generation API

2. **OCR**: Text extraction only works for PDFs
   - Need to add OCR service for images/scans (e.g., Tesseract.js or cloud OCR API)

3. **Production Epic**: Requires real Plasma FHIR credentials
   - See `docs/EPIC_SETUP_GUIDE.md` for production setup

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## Questions?

Refer to:
- `README.md` - Full project documentation
- `docs/EPIC_SETUP_GUIDE.md` - Epic integration details
- `docs/HIPAA_COMPLIANCE.md` - Security and compliance

---

**Note**: Make sure to keep your `.env` file secure and never commit it to version control!

