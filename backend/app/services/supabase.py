import asyncio
from dataclasses import dataclass
from typing import Any, Dict, Optional

from supabase import Client, create_client


@dataclass
class PatientContext:
  """Aggregated patient data used to build LLM prompts."""

  patient: Dict[str, Any]
  doctor: Dict[str, Any]
  epic_snapshot: Optional[Dict[str, Any]]
  recent_notes: Optional[str]


class SupabaseService:
  """Thin wrapper around supabase-py for synchronous operations."""

  def __init__(self, url: str, key: str, storage_bucket: str, reuse_case_enabled: bool = True) -> None:
    self._client: Client = create_client(url, key)
    self.storage_bucket = storage_bucket
    self.reuse_case_enabled = reuse_case_enabled

  @property
  def client(self) -> Client:
    return self._client

  def close(self) -> None:
    """Placeholder for future resource cleanup."""
    return

  async def fetch_patient_context(self, doctor_email: str, patient_email: str) -> PatientContext:
    return await asyncio.to_thread(self._fetch_patient_context_sync, doctor_email, patient_email)

  def _fetch_patient_context_sync(self, doctor_email: str, patient_email: str) -> PatientContext:
    patient = (
      self._client.table("users")
      .select("*")
      .eq("email", patient_email)
      .single()
      .execute()
    ).data

    doctor = (
      self._client.table("users")
      .select("*")
      .eq("email", doctor_email)
      .single()
      .execute()
    ).data

    epic_snapshot = (
      self._client.table("epic_patient_data")
      .select("*")
      .eq("patient_email", patient_email)
      .order("created_at", desc=True)
      .limit(1)
      .maybe_single()
      .execute()
    ).data

    recent_files = (
      self._client.table("patient_files")
      .select("extracted_text")
      .eq("patient_email", patient_email)
      .eq("file_type", "file")
      .order("created_at", desc=True)
      .limit(5)
      .execute()
    ).data or []

    notes = "\n".join(
      filter(None, [file.get("extracted_text", "").strip() for file in recent_files])
    ) or None

    return PatientContext(
      patient=patient,
      doctor=doctor,
      epic_snapshot=epic_snapshot,
      recent_notes=notes,
    )

  async def find_reusable_video(self, case_key: str) -> Optional[Dict[str, Any]]:
    if not self.reuse_case_enabled:
      return None
    return await asyncio.to_thread(self._find_reusable_video_sync, case_key)

  def _find_reusable_video_sync(self, case_key: str) -> Optional[Dict[str, Any]]:
    result = (
      self._client.table("patient_files")
      .select("*")
      .eq("file_type", "video")
      .eq("case_key", case_key)
      .order("created_at", desc=True)
      .limit(1)
      .maybe_single()
      .execute()
    ).data
    return result

  async def save_video_metadata(
    self,
    *,
    doctor_email: str,
    patient_email: str,
    file_url: str,
    file_name: str,
    case_key: str,
  ) -> Dict[str, Any]:
    return await asyncio.to_thread(
      self._save_video_metadata_sync,
      doctor_email,
      patient_email,
      file_url,
      file_name,
      case_key,
    )

  def _save_video_metadata_sync(
    self,
    doctor_email: str,
    patient_email: str,
    file_url: str,
    file_name: str,
    case_key: str,
  ) -> Dict[str, Any]:
    response = (
      self._client.table("patient_files")
      .insert(
        {
          "doctor_email": doctor_email,
          "patient_email": patient_email,
          "file_type": "video",
          "file_url": file_url,
          "file_name": file_name,
          "case_key": case_key,
        }
      )
      .select("*")
      .single()
      .execute()
    )
    return response.data

