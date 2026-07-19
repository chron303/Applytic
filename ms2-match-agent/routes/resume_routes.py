"""
routes/resume_routes.py

FastAPI router exposing three endpoints:

1. POST /parse-resume   (unchanged)
   Accepts a resume path + job description, runs the original
   LangGraph workflow, returns ResumeMatchResponse.

2. POST /match-profile
   Accepts a user_id and parsed_resume (profile.parsed_data from MS1).
   Fetches ALL active postings (with their requirements) from MS1 via
   the internal API, runs the rules_engine → match_explainer sub-graph
   against each one, and writes every result back to MS1's matches
   table via the internal write-back endpoint.
   Returns a summary list of match results.

3. POST /draft-application
   Explicitly invoked when a user approves an 'apply' match for drafting.
   Looks up the match, fetches the posting source_url and the user's
   profile, runs the Playwright-based drafting_worker to fill form fields
   (no submission), drafts free-text fields via Gemini, then writes the
   result to MS1's applications table as status='drafted'.
   NEVER runs automatically — user approval is required.
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from schemas.request import ResumeMatchRequest
from schemas.response import ResumeMatchResponse
from services.ms1_client import (
    fetch_active_postings_with_requirements,
    fetch_match_by_id,
    fetch_posting_by_id,
    fetch_profile_by_user_id,
    write_application_draft,
    write_match_result,
)
from workflow.workflow import get_drafting_workflow, get_match_workflow, get_resume_workflow

logger = logging.getLogger(__name__)

router = APIRouter()

# Compile all graphs once at import time (not per-request)
_resume_workflow = get_resume_workflow()
_match_workflow = get_match_workflow()
_drafting_workflow = get_drafting_workflow()


# ---------------------------------------------------------------------------
# Schemas for /match-profile
# ---------------------------------------------------------------------------

class MatchProfileRequest(BaseModel):
    user_id: str
    parsed_resume: dict[str, Any]  # profile.parsed_data from MS1


class PostingMatchResult(BaseModel):
    posting_id: str
    posting_title: str
    company: str
    verdict: str        # 'apply' | 'maybe' | 'skip'
    score: float
    reasoning: str
    disqualifier: str | None = None
    written_to_ms1: bool = False
    error: str | None = None


class MatchProfileResponse(BaseModel):
    user_id: str
    total_postings_evaluated: int
    results: list[PostingMatchResult]


# ---------------------------------------------------------------------------
# Original /parse-resume endpoint
# ---------------------------------------------------------------------------

@router.post("/parse-resume", response_model=ResumeMatchResponse)
def parse_resume(request: ResumeMatchRequest) -> ResumeMatchResponse:
    """
    Runs a resume through the full parsing-and-matching workflow.

    Request body (ResumeMatchRequest):
        resume_path: path to an already-uploaded resume PDF.
        job_description: full text of the job description to match
            against.

    Returns:
        A ResumeMatchResponse containing match_score, matched_skills,
        missing_skills, recommendations, parsed_resume, and errors.
    """
    logger.info(
        "Received /parse-resume request for resume_path=%s", request.resume_path
    )

    try:
        initial_state = {
            "resume_path": request.resume_path,
            "resume_text": "",
            "parsed_resume": {},
            "job_description": request.job_description,
            "parsed_job": {},
            "matched_skills": [],
            "missing_skills": [],
            "match_score": 0.0,
            "recommendations": [],
            "errors": [],
        }

        final_state = _resume_workflow.invoke(initial_state)

    except Exception as exc:
        logger.error(
            "Unexpected failure while processing /parse-resume for "
            "resume_path=%s: %s",
            request.resume_path,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the resume match request.",
        ) from exc

    logger.info(
        "Completed /parse-resume for resume_path=%s (match_score=%s, %d error(s) recorded)",
        request.resume_path,
        final_state.get("match_score"),
        len(final_state.get("errors", [])),
    )
    return ResumeMatchResponse.model_validate(final_state)


# ---------------------------------------------------------------------------
# New /match-profile endpoint
# ---------------------------------------------------------------------------

@router.post("/match-profile", response_model=MatchProfileResponse)
def match_profile(request: MatchProfileRequest) -> MatchProfileResponse:
    """
    Match a user's profile against ALL active postings in MS1.

    For each active posting:
      1. Run the deterministic rules_engine node.
      2. Run the Gemini match_explainer node.
      3. Write the result back to MS1's /internal/matches endpoint.

    Returns a summary list of all match results.

    Request body:
        user_id:       UUID of the user whose profile we are matching.
        parsed_resume: dict containing the profile's parsed_data
                       (skills, experience, etc.) as stored in MS1.
    """
    logger.info(
        "Received /match-profile request for user_id=%s", request.user_id
    )

    # ---- Fetch all active postings + their requirements from MS1 ---------
    try:
        posting_pairs = fetch_active_postings_with_requirements()
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch postings from MS1: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach MS1 to fetch active postings: {exc}",
        ) from exc

    if not posting_pairs:
        logger.info("No active postings found; returning empty match results")
        return MatchProfileResponse(
            user_id=request.user_id,
            total_postings_evaluated=0,
            results=[],
        )

    results: list[PostingMatchResult] = []

    for pair in posting_pairs:
        posting: dict = pair["posting"]
        requirements: dict = pair["requirements"]
        posting_id: str = posting.get("id", "")
        posting_title: str = posting.get("title", "Unknown")
        company: str = posting.get("company", "Unknown")

        logger.info(
            "Evaluating posting %s (%s @ %s)", posting_id, posting_title, company
        )

        # ---- Run the per-posting match sub-graph -------------------------
        try:
            match_state = {
                "parsed_resume": request.parsed_resume,
                "current_posting": posting,
                "current_requirements": requirements,
                "rules_verdict": {},
                "match_reasoning": "",
                "errors": [],
            }

            final_state = _match_workflow.invoke(match_state)

            rules_verdict: dict = final_state.get("rules_verdict") or {}
            verdict: str = rules_verdict.get("verdict", "skip")
            score: float = rules_verdict.get("score", 0.0)
            disqualifier: str | None = rules_verdict.get("disqualifier")
            reasoning: str = final_state.get("match_reasoning", "")

        except Exception as exc:
            logger.error(
                "Match workflow failed for posting %s: %s", posting_id, exc
            )
            results.append(
                PostingMatchResult(
                    posting_id=posting_id,
                    posting_title=posting_title,
                    company=company,
                    verdict="skip",
                    score=0.0,
                    reasoning="",
                    written_to_ms1=False,
                    error=str(exc),
                )
            )
            continue

        # ---- Write result back to MS1 ------------------------------------
        written = False
        write_error: str | None = None

        if posting_id and request.user_id:
            try:
                write_match_result(
                    user_id=request.user_id,
                    posting_id=posting_id,
                    match_score=score,
                    match_result=verdict,
                    reasoning=reasoning,
                )
                written = True
                logger.info(
                    "Written match result: user=%s posting=%s verdict=%s",
                    request.user_id, posting_id, verdict,
                )
            except httpx.HTTPError as exc:
                write_error = str(exc)
                logger.error(
                    "Failed to write match result for posting %s: %s",
                    posting_id, exc,
                )

        results.append(
            PostingMatchResult(
                posting_id=posting_id,
                posting_title=posting_title,
                company=company,
                verdict=verdict,
                score=score,
                reasoning=reasoning,
                disqualifier=disqualifier,
                written_to_ms1=written,
                error=write_error,
            )
        )

    apply_count = sum(1 for r in results if r.verdict == "apply")
    maybe_count = sum(1 for r in results if r.verdict == "maybe")
    skip_count = sum(1 for r in results if r.verdict == "skip")

    logger.info(
        "Completed /match-profile for user_id=%s: %d apply, %d maybe, %d skip",
        request.user_id, apply_count, maybe_count, skip_count,
    )

    return MatchProfileResponse(
        user_id=request.user_id,
        total_postings_evaluated=len(results),
        results=results,
    )


# ---------------------------------------------------------------------------
# Schemas for /draft-application
# ---------------------------------------------------------------------------

class DraftApplicationRequest(BaseModel):
    match_id: str   # UUID of the matches row the user approved for drafting


class DraftedFieldDetail(BaseModel):
    value: str | None = None
    confidence: float
    note: str = ""


class DraftApplicationResponse(BaseModel):
    match_id: str
    application_id: str | None = None  # MS1 application row ID (None if write failed)
    drafted_fields: dict[str, DraftedFieldDetail]
    draft_errors: list[str]
    written_to_ms1: bool


# ---------------------------------------------------------------------------
# POST /draft-application
# ---------------------------------------------------------------------------

@router.post("/draft-application", response_model=DraftApplicationResponse)
def draft_application(request: DraftApplicationRequest) -> DraftApplicationResponse:
    """
    Draft a Greenhouse application form for an approved 'apply' match.

    Flow:
      1. Fetch the match row from MS1 to get posting_id + user_id.
      2. Fetch the posting row to get source_url, title, company.
      3. Fetch the user's profile to get parsed_resume.
      4. Run the drafting_worker graph (Playwright + Gemini).
      5. Write the draft to MS1's applications table (status='drafted').
      6. Return the drafted fields with per-field confidence scores.

    This endpoint NEVER submits the application — it drafts only.
    All free-text fields (cover letter, why-this-role) are Gemini-generated
    and flagged with confidence=0.3 so the user knows to review them.

    Raises:
        HTTPException(404): match or posting not found in MS1.
        HTTPException(502): MS1 is unreachable.
        HTTPException(500): unexpected error during drafting.
    """
    logger.info("Received /draft-application request for match_id=%s", request.match_id)

    # ---- 1. Fetch match --------------------------------------------------
    try:
        match = fetch_match_by_id(request.match_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Match not found") from exc
        raise HTTPException(status_code=502, detail=f"MS1 error fetching match: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach MS1: {exc}") from exc

    posting_id: str = match.get("posting_id", "")
    user_id: str = match.get("user_id", "")
    match_reasoning: str = match.get("reasoning") or ""

    # ---- 2. Fetch posting ------------------------------------------------
    try:
        posting = fetch_posting_by_id(posting_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Posting not found") from exc
        raise HTTPException(status_code=502, detail=f"MS1 error fetching posting: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach MS1: {exc}") from exc

    source_url: str = posting.get("source_url") or ""

    # ---- 3. Fetch profile ------------------------------------------------
    try:
        profile_row = fetch_profile_by_user_id(user_id)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch profile from MS1: {exc}") from exc

    parsed_resume: dict = {}
    if profile_row:
        parsed_resume = profile_row.get("parsed_data") or {}

    # ---- 4. Run drafting workflow ----------------------------------------
    try:
        drafting_state = {
            "source_url": source_url,
            "parsed_resume": parsed_resume,
            "match_reasoning": match_reasoning,
            "posting": posting,
            "drafted_fields": {},
            "draft_errors": [],
        }
        final_state = _drafting_workflow.invoke(drafting_state)
    except Exception as exc:
        logger.error("Drafting workflow failed for match_id=%s: %s", request.match_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Drafting workflow failed: {exc}",
        ) from exc

    drafted_fields: dict = final_state.get("drafted_fields") or {}
    draft_errors: list[str] = final_state.get("draft_errors") or []

    # ---- 5. Write draft to MS1 ------------------------------------------
    application_id: str | None = None
    written = False

    try:
        app_row = write_application_draft(
            match_id=request.match_id,
            drafted_fields=drafted_fields,
        )
        application_id = app_row.get("id")
        written = True
        logger.info(
            "Application draft written to MS1: match_id=%s application_id=%s",
            request.match_id, application_id,
        )
    except httpx.HTTPError as exc:
        draft_errors.append(f"MS1 write-back failed: {exc}")
        logger.error("Failed to write application draft for match_id=%s: %s", request.match_id, exc)

    # ---- 6. Build response -----------------------------------------------
    typed_fields = {
        k: DraftedFieldDetail(
            value=v.get("value"),
            confidence=v.get("confidence", 0.0),
            note=v.get("note", ""),
        )
        for k, v in drafted_fields.items()
    }

    logger.info(
        "Completed /draft-application for match_id=%s: %d fields drafted, %d errors",
        request.match_id, len(typed_fields), len(draft_errors),
    )

    return DraftApplicationResponse(
        match_id=request.match_id,
        application_id=application_id,
        drafted_fields=typed_fields,
        draft_errors=draft_errors,
        written_to_ms1=written,
    )