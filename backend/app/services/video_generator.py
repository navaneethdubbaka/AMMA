from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Tuple

import httpx


class VideoGeneratorService:
  """Generates personalized avatar videos using HeyGen's Create Avatar Video (V2) API."""

  def __init__(
    self,
    api_key: str,
    avatar_id: str,
    voice_id: str,
    *,
    ratio: str = "16:9",
    background: str | None = None,
    poll_interval: int = 5,
    poll_timeout: int = 300,
  ) -> None:
    if not api_key:
      raise ValueError("HEYGEN_API_KEY is required")
    if not avatar_id:
      raise ValueError("HEYGEN_AVATAR_ID is required")
    if not voice_id:
      raise ValueError("HEYGEN_VOICE_ID is required")

    self._api_key = api_key.strip()
    self._avatar_id = avatar_id.strip()
    self._voice_id = voice_id.strip()
    self._ratio = ratio or "16:9"
    self._background = background
    self._poll_interval = poll_interval
    self._poll_timeout = poll_timeout

  async def create_video(self, script_payload: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a HeyGen avatar video driven entirely by a text script."""
    script_text = self._build_script(script_payload)
    if not script_text:
      raise ValueError("Unable to build script text for HeyGen video.")

    print(f"[INFO] HeyGen script preview:\n{script_text}\n{'-'*40}")
    print("[INFO] Building HeyGen payload with avatar + voice structure")

    avatar_id = metadata.get("avatar_id") or self._avatar_id
    voice_id = metadata.get("voice_id") or self._voice_id

    character = {
      "type": "avatar",
      "avatar_id": avatar_id,
      "avatar_style": metadata.get("avatar_style") or "normal",
    }

    voice = {
      "type": "text",
      "voice_id": voice_id,
      "input_text": script_text,
      "speed": metadata.get("voice_speed") or 1.0,
      "style": metadata.get("voice_style") or "default",
      "pitch": metadata.get("voice_pitch") or 0,
    }

    video_inputs = [
      {
        "character": character,
        "voice": voice,
      }
    ]

    dimension = self._ratio_to_dimension(metadata.get("video_ratio") or self._ratio)

    payload: Dict[str, Any] = {
      "video_inputs": video_inputs,
      "dimension": {"width": dimension[0], "height": dimension[1]},
      "caption": bool(metadata.get("captions", False)),
      "test": bool(metadata.get("test_mode", False)),
      "title": metadata.get("title") or script_payload.get("title") or "Personalized Care Plan",
    }
    print(f"[DEBUG] HeyGen payload:\n{json.dumps(payload, indent=2)}")

    background = metadata.get("background") or self._background
    if background:
      payload["background"] = background

    headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": self._api_key,
    }

    async with httpx.AsyncClient(timeout=120) as client:
      response = await client.post(
        "https://api.heygen.com/v2/video/generate",
        headers=headers,
        json=payload,
      )
      if response.status_code >= 400:
        try:
          error_json = response.json()
        except Exception:
          error_json = {"raw": response.text}
        print(f"[ERROR] HeyGen video request failed: {error_json}")
      response.raise_for_status()
      data = response.json()
      video_id = data["data"]["video_id"]

    status_payload = await self._wait_for_video(video_id)
    video_url = status_payload["video_url"]

    return {
      "id": video_id,
      "status": status_payload["status"],
      "video_url": video_url,
      "thumbnail_url": status_payload.get("thumbnail_url"),
    }

  async def _wait_for_video(self, video_id: str) -> Dict[str, Any]:
    """Poll HeyGen until the avatar video is ready."""
    status_url = f"https://api.heygen.com/v1/video_status.get?video_id={video_id}"
    headers = {
      "Accept": "application/json",
      "X-API-KEY": self._api_key,
    }

    elapsed = 0
    while elapsed <= self._poll_timeout:
      async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(status_url, headers=headers)
        response.raise_for_status()
        payload = response.json()["data"]

      status = payload["status"]
      if status == "completed":
        return payload
      if status == "failed":
        error_msg = payload.get("error") or "Unknown HeyGen error"
        raise RuntimeError(f"HeyGen video generation failed: {error_msg}")

      await asyncio.sleep(self._poll_interval)
      elapsed += self._poll_interval

    raise TimeoutError(f"Timed out waiting for HeyGen video {video_id} after {self._poll_timeout} seconds.")

  def _build_script(self, script_payload: Dict[str, Any]) -> str:
    """Convert the LLM output into a single script string for HeyGen."""
    sections = []

    for key in ["intro", "overview", "content", "details", "treatment", "plan", "reminders", "next_steps"]:
      value = script_payload.get(key)
      if isinstance(value, str) and value.strip():
        sections.append(value.strip())

    if not sections and script_payload.get("content"):
      sections.append(str(script_payload["content"]))

    return "\n\n".join(sections).strip()

  def _ratio_to_dimension(self, ratio: str) -> Tuple[int, int]:
    ratio_key = (ratio or "16:9").strip()
    mapping = {
      "16:9": (1280, 720),
      "9:16": (720, 1280),
      "1:1": (720, 720),
      "4:3": (960, 720),
    }
    return mapping.get(ratio_key, mapping["16:9"])

