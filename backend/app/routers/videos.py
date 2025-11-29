from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_settings, get_supabase_service
from app.models.requests import VideoGenerationRequest
from app.models.responses import VideoGenerationResponse
from app.services import recovery_plan
from app.services.llm import LLMService
from app.services.storage import StorageService
from app.services.supabase import PatientContext, SupabaseService
from app.services.video_generator import VideoGeneratorService


router = APIRouter(prefix="/videos", tags=["videos"])


def get_llm_service() -> LLMService:
  """Lazy initialization of LLM service."""
  settings = get_settings()
  return LLMService(settings.openai_api_key, settings.openai_model)


def get_video_service() -> VideoGeneratorService:
  """Lazy initialization of video service."""
  settings = get_settings()
  return VideoGeneratorService(
    api_key=settings.heygen_api_key,
    avatar_id=settings.heygen_avatar_id,
    voice_id=settings.heygen_voice_id,
    ratio=settings.heygen_ratio,
    background=settings.heygen_background or None,
    poll_interval=settings.heygen_poll_interval,
    poll_timeout=settings.heygen_poll_timeout,
  )


def _context_to_prompt_payload(context: PatientContext, request: VideoGenerationRequest) -> Dict[str, Any]:
  patient = context.patient
  doctor = context.doctor
  diagnoses = []
  medications = []

  if context.epic_snapshot:
    diagnoses = [entry.get("display") for entry in context.epic_snapshot.get("diagnoses", [])]
    medications = [entry.get("name") for entry in context.epic_snapshot.get("medications", [])]

  recovery_details = None
  prior_recovery = []
  if request.recovery_day:
    recovery_details = recovery_plan.get_plan_for_day(request.recovery_day)
    prior_recovery = recovery_plan.get_prior_plans(request.recovery_day)
    if recovery_details and request.recovery_milestone:
      recovery_details["milestone_label"] = request.recovery_milestone

  payload = {
    "patient": patient,
    "doctor": doctor,
    "diagnoses": list(filter(None, diagnoses)),
    "medications": list(filter(None, medications)),
    "notes": context.recent_notes,
    "recovery_plan": recovery_details,
    "prior_recovery_context": prior_recovery,
    "recovery_day": request.recovery_day,
    "recovery_milestone": request.recovery_milestone,
  }
  return payload


@router.post("/generate", response_model=VideoGenerationResponse, status_code=status.HTTP_201_CREATED)
async def generate_video(
  request: VideoGenerationRequest,
  supabase_service: SupabaseService = Depends(get_supabase_service),
) -> VideoGenerationResponse:
  context = await supabase_service.fetch_patient_context(request.doctor_email, request.patient_email)
  prompt_payload = _context_to_prompt_payload(context, request)

  llm_service = get_llm_service()
  prompt = await llm_service.build_prompt(prompt_payload)
  script = await llm_service.request_script(prompt)

  case_key = llm_service.compute_case_key(
    diagnosis_code=request.diagnosis_code,
    procedure_code=request.procedure_code,
    recovery_milestone=request.recovery_milestone,
    doctor_specialty=context.doctor.get("specialty"),
  )

  if not request.force_regenerate:
    reusable = await supabase_service.find_reusable_video(case_key)
    if reusable:
      return VideoGenerationResponse(
        video_url=reusable["file_url"],
        case_key=case_key,
        reused=True,
        metadata_id=reusable.get("id"),
      )

  video_service = get_video_service()
  video_payload = await video_service.create_video(
    script_payload=script,
    metadata={
      "patient_email": request.patient_email,
      "doctor_email": request.doctor_email,
      "diagnosis_code": request.diagnosis_code,
      "procedure_code": request.procedure_code,
      "recovery_milestone": request.recovery_milestone,
    },
  )

  output_url = video_payload.get("video_url")
  if not output_url:
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail="Video provider did not return a video URL.",
    )

  # Handle mock videos (skip download/upload for placeholder URLs)
  if video_payload.get("mock"):
    # For mock videos, use a placeholder video file
    # In production, this would be replaced with actual video from Sora
    supabase_client = supabase_service.client if supabase_service.use_supabase else None
    storage_service = StorageService(
      storage_dir=supabase_service.storage_bucket,
      storage_bucket=supabase_service.storage_bucket,
      supabase_client=supabase_client,
    )
    # Use demo video or create a placeholder
    if not storage_service.use_supabase:
      demo_video_path = storage_service.videos_dir / "demo_video.mp4"
      if not demo_video_path.exists():
        # Create an empty placeholder file (or copy from public folder)
        demo_video_path.touch()
      public_url = f"/storage/videos/demo_video.mp4"
    else:
      # For Supabase, we'd need to upload the demo video, but for now use a placeholder URL
      public_url = f"/storage/videos/demo_video.mp4"
  else:
    # Real video: download and upload to storage
    supabase_client = supabase_service.client if supabase_service.use_supabase else None
    storage_service = StorageService(
      storage_dir=supabase_service.storage_bucket,
      storage_bucket=supabase_service.storage_bucket,
      supabase_client=supabase_client,
    )
    public_url = await storage_service.upload_from_url(output_url, case_key=case_key)

  metadata = await supabase_service.save_video_metadata(
    doctor_email=request.doctor_email,
    patient_email=request.patient_email,
    file_url=public_url,
    file_name=f"{case_key}.mp4",
    case_key=case_key,
  )

  return VideoGenerationResponse(
    video_url=public_url,
    case_key=case_key,
    reused=False,
    metadata_id=metadata.get("id"),
  )

