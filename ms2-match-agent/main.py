"""
main.py

Entry point for the Applytic MS2 Resume Matching Service.

This file's only job is to construct the FastAPI application, wire in
logging and the resume-matching router, and expose two trivial
operational endpoints (root and health). No parsing, matching, or
workflow logic lives here — that all already exists in
routes/resume_routes.py, workflow/workflow.py, and the nodes/utils
modules underneath it. This file just assembles those pieces into a
runnable app.

Run with:
    uvicorn main:app --reload
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.resume_routes import router as resume_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
app = FastAPI(
    title="Applytic MS2 Resume Matching Service",
    version="1.0.0",
    description="LangGraph-powered Resume Parsing and Job Matching API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_router)

@app.get("/")
def root() -> dict[str, str]:
    """
    Root endpoint. Confirms the service is up and reachable at all.

    Returns:
        A static message identifying this service — useful as the
        simplest possible manual check that the app is running,
        independent of the health endpoint below.
    """
    return {"message": "Applytic MS2 Running"}


@app.get("/health")
def health() -> dict[str, str]:
    """
    Health check endpoint.

    Returns:
        A static "healthy" status. Intentionally has no side effects
        and calls nothing else (no Gemini, no workflow, no file I/O)
        — this is what a load balancer or uptime monitor should poll,
        and it needs to stay fast and independent of any downstream
        service's availability.
    """
    return {"status": "healthy"}