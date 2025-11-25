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

settings = get_settings()
llm_service = LLMService(settings.gemini_api_key, settings.gemini_model)
video_service = VideoGeneratorService(settings.video_api_endpoint, settings.video_api_key)


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

  prompt = await llm_service.build_prompt(prompt_payload)
  script = await llm_service.request_script(prompt)

  case_key = llm_service.compute_case_key(
    diagnosis_code=request.diagnosis_code,
    procedure_code=request.procedure_code,
    script_body=script.get("content", prompt),
    doctor_specialty=context.doctor.get("specialty", "general"),
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

  output_url = video_payload.get("output_url")
  if not output_url:
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail="Video provider did not return an output URL.",
    )

  storage_service = StorageService(supabase_service.client, supabase_service.storage_bucket)
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

