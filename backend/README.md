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

Create a `.env` file in `backend/`:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=sk-...
GEMINI_MODEL=gemini-1.5-pro
VIDEO_API_ENDPOINT=https://video.provider.com/v1
VIDEO_API_KEY=vk-...
STORAGE_BUCKET=patient-files
REUSE_CASE_ENABLED=true
```

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

