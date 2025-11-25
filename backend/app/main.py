from fastapi import FastAPI

from app.routers import health, videos


app = FastAPI(
  title="Amma Health Video Service",
  version="0.1.0",
  description="Generates personalized medical explanation videos.",
)

app.include_router(health.router)
app.include_router(videos.router)

