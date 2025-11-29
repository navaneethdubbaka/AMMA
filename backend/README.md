# Amma Health FastAPI Service

Backend service that orchestrates:

1. Fetching patient/doctor context from database (Supabase or local SQLite)
2. Building a personalized explainer prompt via an LLM
3. Requesting an AI video generation provider
4. Uploading the finished MP4 to storage (Supabase Storage or local filesystem) and persisting metadata

## Database & Storage Options

The backend supports two modes:

- **Supabase** (recommended for production): Uses Supabase PostgreSQL database and Supabase Storage
- **Local SQLite** (for development): Uses local SQLite database and local file storage

The system automatically detects which mode to use based on environment variables. If `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided, it uses Supabase. Otherwise, it falls back to local SQLite.

## Setup

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows
pip install -r requirements.txt
```

**IMPORTANT:** Create a `.env` file in `backend/` directory with your actual credentials:

```bash
# Copy the example file
cp env.example .env

# Then edit .env with your actual values
```

### Environment Variables

**Required for all modes:**
```
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o
HEYGEN_API_KEY=your-heygen-api-key
HEYGEN_AVATAR_ID=your-avatar-id
HEYGEN_VOICE_ID=your-voice-id
HEYGEN_RATIO=16:9
HEYGEN_BACKGROUND=
HEYGEN_POLL_INTERVAL=5
HEYGEN_POLL_TIMEOUT=300
REUSE_CASE_ENABLED=true
```

**For Supabase mode (recommended):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key  # Optional, for admin operations
STORAGE_BUCKET=patient-files
```

**For Local SQLite mode (development):**
```
DATABASE_PATH=amma_health.db
STORAGE_DIR=storage
```

**Notes:**
- Without a `.env` file, the server will fail to start with validation errors.
- If both Supabase and local configs are provided, Supabase takes precedence.
- For local SQLite: The database file (`amma_health.db`) will be created automatically on first run.
- Initialize sample data for local SQLite: `python init_db.py`
- For Supabase: Run the SQL setup scripts from `setup/sql/FINAL_DATABASE_SETUP.sql` in your Supabase SQL editor.

## Development

```bash
uvicorn app.main:app --reload --port 8080
```

### Key Endpoints

- `GET /health` – basic readiness probe
- `POST /videos/generate` – triggers fetch → prompt → HeyGen template merge and returns the public video URL. Include optional `recovery_day` (1-30) and `recovery_milestone` to have the service pull the day's schedule plus prior milestone context for the LLM.

The `videos/generate` route automatically checks for reusable videos via a deterministic `case_key`. Pass `force_regenerate=true` to skip reuse.

### HeyGen integration

- Videos are generated via the HeyGen Avatar Video (V2) API using the LLM script directly (no templates). ([API reference](https://docs.heygen.com/reference/create-an-avatar-video-v2))
- Provide `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, and `HEYGEN_VOICE_ID` in `.env`. Optional per-request overrides `avatar_id`, `voice_id`, `video_ratio`, `background`, and `captions` can be supplied in the payload.
- The backend polls `https://api.heygen.com/v1/video_status.get` until the video is completed, then downloads the final MP4 and stores it in storage (Supabase Storage or local filesystem).
- Video reuse is keyed by `diagnosis_code + procedure_code + recovery_milestone + doctor_specialty`. If two requests share those attributes, they will receive the same previously generated video unless `force_regenerate=true` is provided.

#### Sample payload

```json
{
  "doctor_email": "apolakala@berkeley.edu",
  "patient_email": "anish.polakala@gmail.com",
  "diagnosis_code": "I10",
  "procedure_code": "99213",
  "recovery_day": 7,
  "recovery_milestone": "Week 1 mobility coaching"
}
```

