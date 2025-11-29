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
  """Database service supporting both Supabase and local SQLite."""

  def __init__(
    self,
    db_path: str | None = None,
    storage_bucket: str = "patient-files",
    reuse_case_enabled: bool = True,
    supabase_url: str | None = None,
    supabase_key: str | None = None,
  ) -> None:
    self.storage_bucket = storage_bucket
    self.reuse_case_enabled = reuse_case_enabled
    self._connected = False
    
    # Use Supabase if credentials provided, otherwise use local SQLite
    if supabase_url and supabase_key:
      try:
        from supabase import create_client, Client
        self._supabase: Client = create_client(supabase_url, supabase_key)
        self.use_supabase = True
        self._db = None
        print("[INFO] Using Supabase database")
      except ImportError:
        print("[WARN] supabase-py not installed, falling back to local database")
        self.use_supabase = False
        self._supabase = None
        self._db = LocalDatabase(db_path or "amma_health.db")
      except Exception as e:
        print(f"[WARN] Failed to initialize Supabase: {e}, falling back to local database")
        self.use_supabase = False
        self._supabase = None
        self._db = LocalDatabase(db_path or "amma_health.db")
    else:
      self.use_supabase = False
      self._supabase = None
      self._db = LocalDatabase(db_path or "amma_health.db")
      print("[INFO] Using local SQLite database")

  @property
  def client(self):
    """Return database instance for compatibility."""
    if self.use_supabase and self._supabase:
      return self._supabase
    return self._db

  async def _ensure_connected(self):
    """Ensure database connection is established."""
    if not self._connected:
      if not self.use_supabase and self._db:
        await self._db.connect()
      self._connected = True

  async def close(self) -> None:
    """Close database connection."""
    if self._connected:
      if not self.use_supabase and self._db:
        await self._db.close()
      self._connected = False

  async def fetch_patient_context(self, doctor_email: str, patient_email: str) -> PatientContext:
    await self._ensure_connected()

    if self.use_supabase:
      # Supabase queries
      patient_res = self._supabase.table("users").select("*").eq("email", patient_email).execute()
      if not patient_res.data:
        raise ValueError(f"Patient not found: {patient_email}")
      patient = patient_res.data[0]

      doctor_res = self._supabase.table("users").select("*").eq("email", doctor_email).execute()
      if not doctor_res.data:
        raise ValueError(f"Doctor not found: {doctor_email}")
      doctor = doctor_res.data[0]

      print(f"[INFO] Loaded patient record: {patient_email} -> {patient}")
      print(f"[INFO] Loaded doctor record: {doctor_email} -> {doctor}")

      epic_res = (
        self._supabase.table("epic_patient_data")
        .select("*")
        .eq("patient_email", patient_email)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
      )
      epic_snapshot = None
      if epic_res.data:
        epic_data = epic_res.data[0]
        # Parse JSON fields
        if epic_data.get("diagnoses"):
          try:
            epic_data["diagnoses"] = json.loads(epic_data["diagnoses"]) if isinstance(epic_data["diagnoses"], str) else epic_data["diagnoses"]
          except (json.JSONDecodeError, TypeError):
            epic_data["diagnoses"] = []
        if epic_data.get("medications"):
          try:
            epic_data["medications"] = json.loads(epic_data["medications"]) if isinstance(epic_data["medications"], str) else epic_data["medications"]
          except (json.JSONDecodeError, TypeError):
            epic_data["medications"] = []
        epic_snapshot = epic_data

      files_res = (
        self._supabase.table("patient_files")
        .select("*")
        .eq("patient_email", patient_email)
        .eq("file_type", "file")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
      )
      recent_files = files_res.data or []
    else:
      # Local SQLite queries
      patient = await self._db.fetch_one("users", {"email": patient_email})
      if not patient:
        raise ValueError(f"Patient not found: {patient_email}")

      doctor = await self._db.fetch_one("users", {"email": doctor_email})
      if not doctor:
        raise ValueError(f"Doctor not found: {doctor_email}")

      print(f"[INFO] Loaded patient record: {patient_email} -> {patient}")
      print(f"[INFO] Loaded doctor record: {doctor_email} -> {doctor}")

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

    if self.use_supabase:
      res = (
        self._supabase.table("patient_files")
        .select("*")
        .eq("file_type", "video")
        .eq("case_key", case_key)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
      )
      return res.data[0] if res.data else None
    else:
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

    data = {
      "doctor_email": doctor_email,
      "patient_email": patient_email,
      "file_type": "video",
      "file_url": file_url,
      "file_name": file_name,
      "case_key": case_key,
    }

    if self.use_supabase:
      res = self._supabase.table("patient_files").insert(data).execute()
      return res.data[0] if res.data else data
    else:
      return await self._db.insert("patient_files", data)

