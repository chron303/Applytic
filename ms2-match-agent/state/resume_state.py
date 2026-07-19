"""
state/resume_state.py

Defines the shared state objects that flow through the LangGraph
workflow for parsing a resume and matching it against all active
postings.

Three TypedDicts are defined here:
  ResumeState    — original per-request state (kept for backward compat).
  MatchState     — per-posting state used by the rules_engine →
                   match_explainer sub-workflow.
  DraftingState  — per-application state used by the drafting_worker
                   pipeline (triggered explicitly, never auto-run).

This file is deliberately isolated: it imports nothing but the
standard library's `typing` module.
"""

from typing import Any, TypedDict


class ResumeState(TypedDict):
    """
    State for the original parse-and-match workflow.
    Preserved for backward compatibility with /parse-resume.
    """
    resume_path: str
    job_description: str
    resume_text: str
    parsed_resume: dict
    parsed_job: dict
    matched_skills: list[str]
    missing_skills: list[str]
    match_score: float
    recommendations: list[str]
    errors: list[str]


class MatchState(TypedDict):
    """
    Per-posting state for the rules_engine → match_explainer pipeline.

    Populated once per (profile, posting) pair by the /match-profile
    orchestration layer in resume_routes.py, then passed through the
    compiled sub-graph.
    """
    # --- inputs ---
    parsed_resume: dict          # profile.parsed_data
    current_posting: dict        # postings row from MS1
    current_requirements: dict   # requirements.structured_data from MS1

    # --- written by rules_engine ---
    rules_verdict: dict[str, Any]   # {verdict, score, disqualifier, signals}

    # --- written by match_explainer ---
    match_reasoning: str

    # --- error accumulation ---
    errors: list[str]


class DraftingState(TypedDict):
    """
    Per-application state for the drafting_worker pipeline.

    Populated once per explicit drafting request (POST /draft-application).
    The user must explicitly approve a match before this graph is invoked —
    it is never triggered automatically by the match sweep.
    """
    # --- inputs ---
    source_url: str              # posting.source_url (Greenhouse form URL)
    parsed_resume: dict          # profile.parsed_data from MS1
    match_reasoning: str         # from match_explainer, used for Gemini context
    posting: dict                # posting row (title, company, etc.)

    # --- written by drafting_worker ---
    drafted_fields: dict[str, Any]   # field_key -> {value, confidence, note}
    draft_errors: list[str]          # per-field failure strings (non-fatal)
