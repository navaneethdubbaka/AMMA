from typing import Optional

from pydantic import BaseModel


class VideoGenerationResponse(BaseModel):
  video_url: str
  case_key: str
  reused: bool
  metadata_id: Optional[int] = None

