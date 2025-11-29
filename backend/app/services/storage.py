import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

import httpx


class StorageService:
  """Storage service supporting both Supabase Storage and local file system."""

  def __init__(
    self,
    storage_dir: str = "storage",
    storage_bucket: str = "patient-files",
    supabase_client=None,
  ) -> None:
    self.storage_dir = Path(storage_dir)
    self.storage_bucket = storage_bucket
    self._supabase = supabase_client
    self.use_supabase = supabase_client is not None
    
    if not self.use_supabase:
      # Local storage setup
      self.videos_dir = self.storage_dir / "videos"
      self.videos_dir.mkdir(parents=True, exist_ok=True)

  async def upload_from_url(self, source_url: str, *, case_key: str) -> str:
    """Download a video from URL and upload to storage (Supabase or local)."""
    filename = f"{case_key}-{uuid.uuid4().hex}.mp4"
    
    # Download the video first
    async with httpx.AsyncClient(timeout=120) as client:
      response = await client.get(source_url)
      response.raise_for_status()
      video_data = response.content

    if self.use_supabase:
      # Upload to Supabase Storage
      file_path = f"videos/{filename}"
      try:
        # Upload file to Supabase Storage bucket
        upload_res = self._supabase.storage.from_(self.storage_bucket).upload(
          file_path,
          video_data,
          file_options={"content-type": "video/mp4", "upsert": "false"}
        )
        
        # Get public URL
        url_data = self._supabase.storage.from_(self.storage_bucket).get_public_url(file_path)
        public_url = url_data if isinstance(url_data, str) else url_data.get("publicUrl", url_data)
        print(f"[INFO] Video uploaded to Supabase Storage: {public_url}")
        return public_url
      except Exception as e:
        print(f"[ERROR] Supabase upload failed: {e}, falling back to local storage")
        # Fall back to local storage on error
        self.use_supabase = False
        self.videos_dir = self.storage_dir / "videos"
        self.videos_dir.mkdir(parents=True, exist_ok=True)
    
    # Local storage fallback
    file_path = self.videos_dir / filename
    await asyncio.to_thread(file_path.write_bytes, video_data)
    return f"/storage/videos/{filename}"

