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

  database_path: str = Field(default="amma_health.db", alias="DATABASE_PATH")
  storage_dir: str = Field(default="storage", alias="STORAGE_DIR")
  openai_api_key: str = Field(..., alias="OPENAI_API_KEY")  # Required
  openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
  openai_sora_model: str = Field(default="sora-2", alias="OPENAI_SORA_MODEL")
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
  service = SupabaseService(
    db_path=settings.database_path,
    storage_bucket=settings.storage_dir,
    reuse_case_enabled=settings.reuse_case_enabled
  )
  try:
    yield service
  finally:
    await service.close()

