from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import httpx


class VideoGeneratorService:
  """Interface to third-party or internal video generation APIs."""

  def __init__(self, endpoint: str, api_key: str) -> None:
    self.endpoint = endpoint.rstrip("/")
    self.api_key = api_key

  async def create_video(self, script_payload: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Kick off video generation and poll for completion."""
    headers = {"Authorization": f"Bearer {self.api_key}"}

    async with httpx.AsyncClient(timeout=60) as client:
      response = await client.post(
        f"{self.endpoint}/videos",
        json={"script": script_payload, "metadata": metadata},
        headers=headers,
      )
      response.raise_for_status()
      job = response.json()

    job_id = job["id"]
    return await self._poll_for_video(job_id)

  async def _poll_for_video(self, job_id: str, *, poll_interval: float = 3.0, max_attempts: int = 40) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {self.api_key}"}
    async with httpx.AsyncClient(timeout=60) as client:
      for _ in range(max_attempts):
        response = await client.get(f"{self.endpoint}/videos/{job_id}", headers=headers)
        response.raise_for_status()
        payload = response.json()

        if payload.get("status") == "completed":
          return payload
        if payload.get("status") == "failed":
          raise RuntimeError(f"Video generation failed: {payload}")
        await asyncio.sleep(poll_interval)

    raise TimeoutError(f"Video generation timed out for job {job_id}")

