from typing import Optional

from pydantic import BaseModel, Field, constr


class VideoGenerationRequest(BaseModel):
  doctor_email: constr(strip_whitespace=True, to_lower=True)
  patient_email: constr(strip_whitespace=True, to_lower=True)
  diagnosis_code: str = Field(..., description="ICD-10 or SNOMED code representing the condition.")
  procedure_code: str = Field(..., description="Procedure code tied to the visit.")
  recovery_day: Optional[int] = Field(
    default=None,
    description="Optional day number (1-30) for the recovery plan schedule.",
  )
  recovery_milestone: Optional[str] = Field(
    default=None,
    description="Optional milestone identifier for recovery plan clips.",
  )
  force_regenerate: bool = Field(
    False,
    description="Skip cache reuse and force a fresh video generation.",
  )

