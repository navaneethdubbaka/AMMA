import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

import httpx


class StorageService:
  """Local file storage service (replaces Supabase storage for development)."""

  def __init__(self, storage_dir: str = "storage") -> None:
    self.storage_dir = Path(storage_dir)
    self.videos_dir = self.storage_dir / "videos"
    self.videos_dir.mkdir(parents=True, exist_ok=True)

  async def upload_from_url(self, source_url: str, *, case_key: str) -> str:
    """Download a video from URL or copy from file path and save it to local storage."""
    filename = f"{case_key}-{uuid.uuid4().hex}.mp4"
    file_path = self.videos_dir / filename

    # Check if source_url is a file path (from Sora download) or a URL
    if source_url.startswith("/") or source_url.startswith("\\") or ":" in source_url and not source_url.startswith("http"):
      # It's a file path - copy it
      from pathlib import Path
      source_path = Path(source_url)
      if source_path.exists():
        import shutil
        await asyncio.to_thread(shutil.copy2, source_path, file_path)
        # Clean up temp file
        try:
          await asyncio.to_thread(source_path.unlink)
        except:
          pass
      else:
        raise FileNotFoundError(f"Source file not found: {source_url}")
    else:
      # It's a URL - download it
      async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(source_url)
        response.raise_for_status()
        payload = response.content

      await asyncio.to_thread(file_path.write_bytes, payload)

    # Return a file:// URL or relative path that can be served by FastAPI
    # In production, you'd serve this via a static file endpoint
    return f"/storage/videos/{filename}"

