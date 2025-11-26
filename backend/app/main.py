from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.routers import health, videos


app = FastAPI(
  title="Amma Health Video Service",
  version="0.1.0",
  description="Generates personalized medical explanation videos.",
)

app.include_router(health.router)
app.include_router(videos.router)

# Serve static files (videos) from storage directory
storage_path = Path("storage")
if storage_path.exists():
  app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")

