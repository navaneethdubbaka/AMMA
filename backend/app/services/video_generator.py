from __future__ import annotations

import asyncio
import hashlib
from typing import Any, Dict, Optional

import httpx
from openai import AsyncOpenAI


class VideoGeneratorService:
  """Interface to OpenAI Sora 2 for video generation."""

  def __init__(self, api_key: str, model_name: str = "sora-2") -> None:
    if not api_key:
      raise ValueError("OpenAI API key is required")
    if not api_key.strip():
      raise ValueError("OpenAI API key is empty")
    self._api_key = api_key.strip()
    self._client = AsyncOpenAI(api_key=self._api_key)
    
    # Validate and normalize model name
    # Supported models: "sora-2" or "sora-2-pro"
    if model_name and model_name.lower() in ["sora", "sora-1", "sora-1.5"]:
      print(f"[WARNING] Model '{model_name}' is not supported. Using 'sora-2' instead.")
      self._model = "sora-2"
    elif model_name and model_name.lower() in ["sora-2", "sora-2-pro"]:
      self._model = model_name
    else:
      # Default to sora-2 if invalid or empty
      print(f"[WARNING] Model '{model_name}' may not be valid. Using 'sora-2' as default.")
      self._model = "sora-2"
    
    # Try real API first, fallback to mock if not available
    self._use_mock = False
    # Debug: log API key status (first 7 chars only for security)
    print(f"[DEBUG] VideoGeneratorService initialized with model: {self._model}, API key: {self._api_key[:7]}...{self._api_key[-4:] if len(self._api_key) > 11 else '***'}")

  async def create_video(self, script_payload: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Kick off Sora 2 video generation and poll for completion."""
    video_prompt = self._build_video_prompt(script_payload)
    
    # Try real Sora 2 API first
    try:
      return await self._create_sora_video(video_prompt)
    except (AttributeError, NotImplementedError, Exception) as e:
      # Fallback to mock if API not available
      print(f"[WARNING] Sora 2 API not available ({e}), using mock implementation")
      return await self._create_mock_video(script_payload, metadata)

  async def _create_sora_video(self, video_prompt: str) -> Dict[str, Any]:
    """Create video using Sora 2 API based on DataCamp guide."""
    if not self._api_key:
      raise ValueError("API key is not set")
    
    # Validate API key format (should start with sk-)
    if not self._api_key.startswith("sk-"):
      print(f"[WARNING] API key doesn't start with 'sk-'. First 10 chars: {self._api_key[:10]}...")
    
    # Try direct HTTP API call first (more reliable than SDK for new APIs)
    # The SDK might not have the videos endpoint implemented yet
    # Note: Sora 2 API uses multipart/form-data, not JSON
    try:
      print(f"[DEBUG] Attempting Sora 2 API call with model: {self._model}")
      # Verify API key format
      auth_header = f"Bearer {self._api_key}"
      print(f"[DEBUG] Auth header format: Bearer {self._api_key[:7]}...{self._api_key[-4:] if len(self._api_key) > 11 else '***'}")
      
      async with httpx.AsyncClient() as client:
        # Sora 2 API uses multipart/form-data (like curl -F)
        # httpx requires using files parameter to send multipart/form-data
        # For text fields, we can use tuples with None as filename
        # Match the curl format: -F "model=sora-2" -F "prompt=..."
        files = {
          "model": (None, self._model),
          "prompt": (None, video_prompt),
          # Optional parameters (API will use defaults if not provided)
          # "resolution": (None, "1280x720"),  # Optional: 720x1280, 1280x720, 1920x1080
          # "duration": (None, "8"),  # Optional: 4, 8, or 16 seconds
        }
        response = await client.post(
          "https://api.openai.com/v1/videos",
          headers={
            "Authorization": auth_header,
            # Don't set Content-Type - httpx will set multipart/form-data automatically
          },
          files=files,
          timeout=120.0
        )
        
        # Check for authentication errors specifically
        if response.status_code == 401:
          error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
          error_msg = error_data.get("error", {}).get("message", "Authentication failed")
          raise ValueError(f"OpenAI API authentication failed: {error_msg}. Please check your API key.")
        
        # Check for 403 Forbidden (account doesn't have access to Sora 2 API)
        if response.status_code == 403:
          error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
          error_msg = error_data.get("error", {}).get("message", "Access forbidden")
          print(f"[INFO] Sora 2 API access not available for this account (403 Forbidden). This is normal if Sora 2 API is in limited beta. Falling back to mock implementation.")
          raise NotImplementedError(f"Sora 2 API access not available: {error_msg}. Your account may need to be whitelisted for Sora 2 API access.")
        
        # Check for 400 errors (bad request - might be API not available or wrong endpoint)
        if response.status_code == 400:
          error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
          error_msg = error_data.get("error", {}).get("message", "Bad request")
          error_type = error_data.get("error", {}).get("type", "unknown")
          print(f"[ERROR] Sora 2 API returned 400: {error_type} - {error_msg}")
          
          # If it's an auth error in 400 response, check if API key might be the issue
          if "authentication" in error_msg.lower() or "bearer" in error_msg.lower() or "missing" in error_msg.lower():
            # This could mean:
            # 1. API key is invalid/empty
            # 2. The endpoint doesn't exist and returns a generic error
            # 3. The endpoint requires different authentication
            print(f"[ERROR] Possible authentication issue. API key length: {len(self._api_key)}, starts with 'sk-': {self._api_key.startswith('sk-')}")
            # For now, treat this as API not available since the endpoint might not exist
            raise NotImplementedError(f"Sora 2 API endpoint may not be available yet. Error: {error_msg}. The /v1/videos endpoint might not be publicly accessible.")
          
          # Otherwise, it might be that the API endpoint doesn't exist yet
          raise NotImplementedError(f"Sora 2 API endpoint not available: {error_msg}")
        
        response.raise_for_status()
        data = response.json()
        job_id = data.get("id")
        status = data.get("status", "queued")
        
        print(f"[DEBUG] Sora 2 API response: id={job_id}, status={status}, progress={data.get('progress', 0)}%")
        
        if job_id:
          # If status is already completed, download immediately
          if status == "completed":
            video_url = await self._download_video_content(job_id)
            return {
              "id": job_id,
              "status": "completed",
              "video_url": video_url,
            }
          # Otherwise, poll for completion
          return await self._poll_for_video(job_id)
        
        # Fallback (shouldn't happen with proper API response)
        return {
          "id": data.get("id", "unknown"),
          "status": status,
          "video_url": data.get("video_url") or data.get("url"),
        }
    except (ValueError, NotImplementedError):
      # Re-raise authentication or API availability errors
      raise
    except Exception as e:
      # For other errors, try SDK method as fallback
      print(f"[DEBUG] HTTP method failed ({e}), trying SDK method...")
      try:
        # Sora 2 API uses client.videos.create() (not client.video.generations.create)
        if hasattr(self._client, 'videos') and hasattr(self._client.videos, 'create'):
          # Use the correct Sora 2 API method
          response = await self._client.videos.create(
            model=self._model,  # "sora-2" or "sora-2-pro"
            prompt=video_prompt,
            resolution="1280x720",  # Options: 720x1280, 1280x720, 1920x1080
            duration=8,  # Duration in seconds (4, 8, or 16)
          )
          job_id = response.id
          return await self._poll_for_video(job_id)
        else:
          raise NotImplementedError(f"Sora 2 API not available: SDK method not found and HTTP method failed: {e}")
      except Exception as sdk_error:
        raise NotImplementedError(f"Sora 2 API call failed: HTTP error: {e}, SDK error: {sdk_error}")

  async def _create_mock_video(self, script_payload: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Mock video generation for development/testing."""
    # Build video prompt
    video_prompt = self._build_video_prompt(script_payload)
    
    # Simulate video generation delay
    await asyncio.sleep(2)
    
    # Generate a deterministic "video URL" based on the prompt
    # In production, this would be replaced with actual Sora API call
    prompt_hash = hashlib.md5(video_prompt.encode()).hexdigest()[:12]
    
    # Return mock response with a placeholder URL
    # In a real implementation, this would be the actual video URL from Sora
    return {
      "id": f"mock_video_{prompt_hash}",
      "status": "completed",
      "video_url": f"https://example.com/videos/mock_{prompt_hash}.mp4",  # Placeholder URL
      "video_file_id": f"file_{prompt_hash}",
      "prompt": video_prompt,  # Include for debugging
      "mock": True  # Flag to indicate this is a mock response
    }

  def _build_video_prompt(self, script_payload: Dict[str, Any]) -> str:
    """Convert script JSON into a visual video prompt for Sora 2 (following DataCamp guide template)."""
    # Build prompt following Sora 2 best practices from DataCamp guide
    prompt_parts = []
    
    # Scene description
    scene_desc = []
    if "intro" in script_payload:
      scene_desc.append(script_payload['intro'])
    if "overview" in script_payload:
      scene_desc.append(script_payload['overview'])
    if "treatment" in script_payload:
      scene_desc.append(script_payload['treatment'])
    
    if scene_desc:
      prompt_parts.append(" ".join(scene_desc))
    elif "content" in script_payload:
      prompt_parts.append(script_payload["content"])
    
    # Add cinematography section
    prompt_parts.append("\n\nCinematography:")
    prompt_parts.append("Camera shot: eye-level shot, warm professional lighting")
    prompt_parts.append("Mood: clear, compassionate, and reassuring")
    
    # Add actions section
    prompt_parts.append("\n\nActions:")
    if "intro" in script_payload:
      prompt_parts.append(f"- {script_payload['intro']}")
    if "overview" in script_payload:
      prompt_parts.append(f"- {script_payload['overview']}")
    if "treatment" in script_payload:
      prompt_parts.append(f"- {script_payload['treatment']}")
    if "reminders" in script_payload:
      prompt_parts.append(f"- {script_payload['reminders']}")
    
    # Add visual style
    prompt_parts.append("\n\nProfessional medical animation style, clear and compassionate visuals, modern healthcare setting.")
    
    return "\n".join(prompt_parts)

  async def _poll_for_video(self, job_id: str, *, poll_interval: float = 5.0, max_attempts: int = 120) -> Dict[str, Any]:
    """Poll Sora 2 API for video generation status (based on DataCamp guide)."""
    for attempt in range(max_attempts):
      try:
        # Try SDK method first (client.videos.retrieve)
        if hasattr(self._client, 'videos') and hasattr(self._client.videos, 'retrieve'):
          job = await self._client.videos.retrieve(job_id)
          status = job.status
          progress = getattr(job, 'progress', None)
          
          if progress is not None:
            print(f"[Sora 2] Status: {status}, {progress}%")
          
          if status == "completed":
            # Download the video content
            video_url = await self._download_video_content(job_id)
            return {
              "id": job.id,
              "status": "completed",
              "video_url": video_url,
            }
          elif status == "failed":
            error_msg = getattr(job, 'error', None)
            if error_msg:
              error_text = getattr(error_msg, 'message', str(error_msg))
            else:
              error_text = "Unknown error"
            raise RuntimeError(f"Video generation failed: {error_text}")
        else:
          # Fallback to direct API call
          async with httpx.AsyncClient() as client:
            api_response = await client.get(
              f"https://api.openai.com/v1/videos/{job_id}",
              headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json"
              },
              timeout=30.0
            )
            api_response.raise_for_status()
            response_data = api_response.json()
            status = response_data.get("status")
            progress = response_data.get("progress")
            
            if progress is not None:
              print(f"[Sora 2] Status: {status}, {progress}%")
            
            if status == "completed":
              # Download the video content
              video_url = await self._download_video_content(job_id)
              return {
                "id": response_data.get("id"),
                "status": "completed",
                "video_url": video_url,
              }
            elif status == "failed":
              error = response_data.get("error", {})
              error_text = error.get("message", "Unknown error") if isinstance(error, dict) else str(error)
              raise RuntimeError(f"Video generation failed: {error_text}")
        
        await asyncio.sleep(poll_interval)
      except RuntimeError:
        # Re-raise RuntimeError (failed status)
        raise
      except Exception as e:
        if attempt == max_attempts - 1:
          raise
        await asyncio.sleep(poll_interval)

    raise TimeoutError(f"Video generation timed out for job {job_id}")

  async def _download_video_content(self, video_id: str) -> str:
    """Download video content from Sora 2 API and save to temporary file."""
    try:
      # Try SDK method first
      if hasattr(self._client, 'videos') and hasattr(self._client.videos, 'download_content'):
        response = await self._client.videos.download_content(video_id=video_id)
        # The response might be a file-like object or bytes
        if hasattr(response, 'read'):
          video_bytes = await asyncio.to_thread(response.read)
        else:
          video_bytes = response
      else:
        # Fallback to direct API call
        async with httpx.AsyncClient() as client:
          api_response = await client.get(
            f"https://api.openai.com/v1/videos/{video_id}/content",
            headers={
              "Authorization": f"Bearer {self._api_key}",
            },
            timeout=120.0
          )
          api_response.raise_for_status()
          video_bytes = api_response.content
      
      # Save to temporary file and return path
      # The storage service will handle moving it to the right location
      import tempfile
      temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
      if isinstance(video_bytes, bytes):
        await asyncio.to_thread(temp_file.write, video_bytes)
      else:
        # If it's already a file-like object, copy it
        import shutil
        await asyncio.to_thread(shutil.copyfileobj, video_bytes, temp_file)
      await asyncio.to_thread(temp_file.close)
      
      # Return the temp file path - storage service will handle it
      return temp_file.name
    except Exception as e:
      raise RuntimeError(f"Failed to download video content: {e}")

