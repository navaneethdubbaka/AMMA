import asyncio
import os
from functools import lru_cache
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.services.supabase import SupabaseService


# Determine backend directory and .env file path
_backend_dir = Path(__file__).parent.parent.resolve()
_env_file = _backend_dir / ".env"

# Load .env file before creating Settings
if _env_file.exists():
    load_dotenv(dotenv_path=str(_env_file), override=True)
else:
    # Fallback: try current directory
    load_dotenv(override=True)


class Settings(BaseSettings):
  """Runtime configuration loaded from environment variables."""

  # Database configuration (local or Supabase)
  database_path: str = Field(default="amma_health.db", alias="DATABASE_PATH")
  supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
  supabase_anon_key: str | None = Field(default=None, alias="SUPABASE_ANON_KEY")
  supabase_service_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_KEY")
  
  # Storage configuration
  storage_dir: str = Field(default="storage", alias="STORAGE_DIR")
  storage_bucket: str = Field(default="patient-files", alias="STORAGE_BUCKET")
  
  # OpenAI configuration
  openai_api_key: str = Field(..., alias="OPENAI_API_KEY")  # Required
  openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
  
  # HeyGen configuration
  heygen_api_key: str = Field(..., alias="HEYGEN_API_KEY")
  heygen_avatar_id: str = Field(..., alias="HEYGEN_AVATAR_ID")
  heygen_voice_id: str = Field(..., alias="HEYGEN_VOICE_ID")
  heygen_ratio: str = Field(default="16:9", alias="HEYGEN_RATIO")
  heygen_background: str | None = Field(default=None, alias="HEYGEN_BACKGROUND")
  heygen_poll_interval: int = Field(default=5, alias="HEYGEN_POLL_INTERVAL")
  heygen_poll_timeout: int = Field(default=300, alias="HEYGEN_POLL_TIMEOUT")
  
  # Feature flags
  reuse_case_enabled: bool = Field(default=True, alias="REUSE_CASE_ENABLED")

  model_config = SettingsConfigDict(
    env_file=str(_env_file) if _env_file.exists() else ".env",
    env_file_encoding="utf-8",
    case_sensitive=False,  # Case insensitive matching
    extra="ignore",
    populate_by_name=True,  # Allow both field name and alias
  )


@lru_cache
def get_settings() -> Settings:
  """Return cached settings instance."""
  return Settings()  # type: ignore[arg-type]


async def get_supabase_service() -> AsyncGenerator[SupabaseService, None]:
  """Provide a database service instance per-request."""
  settings = get_settings()
  
  # Use service key for admin operations if available, otherwise use anon key
  supabase_key = settings.supabase_service_key or settings.supabase_anon_key
  
  service = SupabaseService(
    db_path=settings.database_path,
    storage_bucket=settings.storage_bucket,
    reuse_case_enabled=settings.reuse_case_enabled,
    supabase_url=settings.supabase_url,
    supabase_key=supabase_key,
  )
  try:
    yield service
  finally:
    await service.close()

