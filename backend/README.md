# Amma Health FastAPI Service

Backend service that orchestrates:

1. Fetching patient/doctor context from Supabase
2. Building a personalized explainer prompt via an LLM
3. Requesting an AI video generation provider
4. Uploading the finished MP4 to Supabase Storage and persisting metadata

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

Required environment variables:
```
DATABASE_PATH=amma_health.db
STORAGE_DIR=storage
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_SORA_MODEL=sora
REUSE_CASE_ENABLED=true
```

**Note:** 
- Without a `.env` file, the server will fail to start with validation errors.
- The database file (`amma_health.db`) will be created automatically on first run.
- Initialize sample data: `python init_db.py`

## Development

```bash
uvicorn app.main:app --reload --port 8080
```

### Key Endpoints

- `GET /health` – basic readiness probe
- `POST /videos/generate` – triggers fetch → prompt → video pipeline and returns the public video URL. Include optional `recovery_day` (1-30) and `recovery_milestone` to have the service pull the day's schedule plus prior milestone context for the LLM.

The `videos/generate` route automatically checks for reusable videos via a deterministic `case_key`. Pass `force_regenerate=true` to skip reuse.

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

