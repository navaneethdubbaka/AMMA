import asyncio
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

from app.services.database import LocalDatabase


@dataclass
class PatientContext:
  """Aggregated patient data used to build LLM prompts."""

  patient: Dict[str, Any]
  doctor: Dict[str, Any]
  epic_snapshot: Optional[Dict[str, Any]]
  recent_notes: Optional[str]


class SupabaseService:
  """Local database service (replaces Supabase for development)."""

  def __init__(self, db_path: str, storage_bucket: str, reuse_case_enabled: bool = True) -> None:
    self._db = LocalDatabase(db_path)
    self.storage_bucket = storage_bucket
    self.reuse_case_enabled = reuse_case_enabled
    self._connected = False

  @property
  def client(self):
    """Return database instance for compatibility."""
    return self._db

  async def _ensure_connected(self):
    """Ensure database connection is established."""
    if not self._connected:
      await self._db.connect()
      self._connected = True

  async def close(self) -> None:
    """Close database connection."""
    if self._connected:
      await self._db.close()
      self._connected = False

  async def fetch_patient_context(self, doctor_email: str, patient_email: str) -> PatientContext:
    await self._ensure_connected()

    patient = await self._db.fetch_one("users", {"email": patient_email})
    if not patient:
      raise ValueError(f"Patient not found: {patient_email}")

    doctor = await self._db.fetch_one("users", {"email": doctor_email})
    if not doctor:
      raise ValueError(f"Doctor not found: {doctor_email}")

    epic_rows = await self._db.fetch_all(
      "epic_patient_data",
      {"patient_email": patient_email},
      order_by="created_at",
      limit=1
    )
    epic_snapshot = None
    if epic_rows:
      epic_data = epic_rows[0]
      # Parse JSON fields
      if epic_data.get("diagnoses"):
        try:
          epic_data["diagnoses"] = json.loads(epic_data["diagnoses"])
        except (json.JSONDecodeError, TypeError):
          epic_data["diagnoses"] = []
      if epic_data.get("medications"):
        try:
          epic_data["medications"] = json.loads(epic_data["medications"])
        except (json.JSONDecodeError, TypeError):
          epic_data["medications"] = []
      epic_snapshot = epic_data

    recent_files = await self._db.fetch_all(
      "patient_files",
      {"patient_email": patient_email, "file_type": "file"},
      order_by="created_at",
      limit=5
    )

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
    await self._ensure_connected()

    results = await self._db.fetch_all(
      "patient_files",
      {"file_type": "video", "case_key": case_key},
      order_by="created_at",
      limit=1
    )
    return results[0] if results else None

  async def save_video_metadata(
    self,
    *,
    doctor_email: str,
    patient_email: str,
    file_url: str,
    file_name: str,
    case_key: str,
  ) -> Dict[str, Any]:
    await self._ensure_connected()

    return await self._db.insert(
      "patient_files",
      {
        "doctor_email": doctor_email,
        "patient_email": patient_email,
        "file_type": "video",
        "file_url": file_url,
        "file_name": file_name,
        "case_key": case_key,
      }
    )

