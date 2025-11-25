import asyncio
import os
import uuid
from typing import Optional

import httpx

from supabase import Client


class StorageService:
  """Uploads generated videos into the Supabase storage bucket."""

  def __init__(self, client: Client, bucket: str) -> None:
    self._client = client
    self.bucket = bucket

  async def upload_from_url(self, source_url: str, *, case_key: str) -> str:
    """Download a video from URL and upload it to Supabase storage."""
    filename = f"{case_key}-{uuid.uuid4().hex}.mp4"
    path = os.path.join("videos", filename)

    async with httpx.AsyncClient(timeout=120) as client:
      response = await client.get(source_url)
      response.raise_for_status()
      payload = response.content

    await asyncio.to_thread(self._client.storage.from_(self.bucket).upload, path, payload, {"upsert": True})
    public_url = self._client.storage.from_(self.bucket).get_public_url(path)  # type: ignore[assignment]
    return public_url

