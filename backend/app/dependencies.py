import asyncio
from functools import lru_cache
from typing import AsyncGenerator

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.services.supabase import SupabaseService


load_dotenv()


class Settings(BaseModel):
  """Runtime configuration loaded from environment variables."""

  supabase_url: str = Field(..., alias="SUPABASE_URL")
  supabase_service_key: str = Field(..., alias="SUPABASE_SERVICE_KEY")
  gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
  gemini_model: str = Field("gemini-1.5-pro", alias="GEMINI_MODEL")
  video_api_endpoint: str = Field(..., alias="VIDEO_API_ENDPOINT")
  video_api_key: str = Field(..., alias="VIDEO_API_KEY")
  storage_bucket: str = Field("patient-files", alias="STORAGE_BUCKET")
  reuse_case_enabled: bool = Field(True, alias="REUSE_CASE_ENABLED")

  model_config = {
    "populate_by_name": True
  }


@lru_cache
def get_settings() -> Settings:
  """Return cached settings instance."""
  return Settings()  # type: ignore[arg-type]


async def get_supabase_service() -> AsyncGenerator[SupabaseService, None]:
  """Provide a Supabase service instance per-request."""
  settings = get_settings()
  service = SupabaseService(
    url=settings.supabase_url,
    key=settings.supabase_service_key,
    storage_bucket=settings.storage_bucket,
    reuse_case_enabled=settings.reuse_case_enabled
  )
  try:
    yield service
  finally:
    await asyncio.to_thread(service.close)

