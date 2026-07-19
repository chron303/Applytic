"""
services/ms1_client.py

Internal HTTP client for MS2 → MS1 calls.

MS2 is stateless; all persistence goes through MS1's internal API.
This module encapsulates every outbound HTTP call MS2 makes to MS1:

  1. fetch_active_postings_with_requirements()
     GETs active postings joined with their requirements from MS1.

  2. write_match_result()
     POSTs a match result (score, verdict, reasoning) to MS1's
     /internal/matches endpoint.

All requests include the shared INTERNAL_API_KEY header that MS1's
requireInternalAuth middleware expects (see ms1-core-api/src/routes/internal.ts).

httpx is used (already available in Python environments) instead of
requests, consistent with modern async-friendly FastAPI services.
Calls are made synchronously here because the LangGraph nodes that
call this are themselves sync — keep it simple.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

MS1_INTERNAL_URL: str = os.getenv("MS1_INTERNAL_URL", "http://ms1:3000")
INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")

_HEADERS: dict[str, str] = {
    "x-internal-api-key": INTERNAL_API_KEY,
    "Content-Type": "application/json",
}

# Default timeout for all MS1 calls (seconds)
_TIMEOUT = 15.0


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_active_postings_with_requirements() -> list[dict[str, Any]]:
    """
    Fetch all active postings from MS1 and pair each with its
    requirements row (structured_data).

    Returns a list of dicts, each shaped as:
        {
            "posting": { ...postings columns... },
            "requirements": { ...structured_data dict or {} ... },
        }

    Raises httpx.HTTPError on network / auth failures so the caller can
    decide whether to abort the whole match run or just log and skip.
    """
    url = f"{MS1_INTERNAL_URL}/postings"
    params = {"status": "active", "limit": "100", "offset": "0"}

    logger.info("Fetching active postings from MS1: %s", url)

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.get(url, headers=_HEADERS, params=params)
        resp.raise_for_status()
        postings: list[dict] = resp.json()

    logger.info("Fetched %d active postings", len(postings))

    # Fetch each posting's requirements
    results: list[dict[str, Any]] = []
    with httpx.Client(timeout=_TIMEOUT) as client:
        for posting in postings:
            posting_id = posting.get("id")
            req_data: dict = {}
            if posting_id:
                try:
                    req_resp = client.get(
                        f"{MS1_INTERNAL_URL}/requirements",
                        headers=_HEADERS,
                        params={"posting_id": posting_id, "limit": "1"},
                    )
                    if req_resp.status_code == 200:
                        req_list = req_resp.json()
                        if req_list:
                            req_data = req_list[0].get("structured_data") or {}
                except httpx.HTTPError as exc:
                    logger.warning(
                        "Could not fetch requirements for posting %s: %s",
                        posting_id, exc,
                    )
            results.append({"posting": posting, "requirements": req_data})

    return results


# ---------------------------------------------------------------------------
# Write-back
# ---------------------------------------------------------------------------

def write_match_result(
    user_id: str,
    posting_id: str,
    match_score: float,
    match_result: str,
    reasoning: str,
) -> dict[str, Any]:
    """
    POST a match result to MS1's /internal/matches endpoint.

    Corresponds to the saveMatchResult() function in ms1's ms2Client.ts
    contract (Block 1, Prompt 3).

    Returns the created match row dict from MS1.
    Raises httpx.HTTPError on failure.
    """
    url = f"{MS1_INTERNAL_URL}/internal/matches"
    payload = {
        "user_id": user_id,
        "posting_id": posting_id,
        "match_score": match_score,
        "match_result": match_result,
        "reasoning": reasoning,
    }

    logger.info(
        "Writing match result to MS1: user=%s posting=%s verdict=%s",
        user_id, posting_id, match_result,
    )

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(url, json=payload, headers=_HEADERS)
        resp.raise_for_status()
        return resp.json()


def write_application_draft(
    match_id: str,
    drafted_fields: dict[str, Any],
) -> dict[str, Any]:
    """
    POST a drafted application to MS1's /internal/applications endpoint.

    Corresponds to the saveDraftedApplication() write-back in the ms1
    internal API contract. Sets status='drafted' per the applications
    table schema.

    Args:
        match_id       : UUID of the match row this draft belongs to.
        drafted_fields : field_key -> {value, confidence, note} dict as
                         returned by drafting_worker.draft_application().

    Returns the created application row dict from MS1.
    Raises httpx.HTTPError on failure.
    """
    url = f"{MS1_INTERNAL_URL}/internal/applications"
    payload = {
        "match_id": match_id,
        "drafted_fields": drafted_fields,
        "status": "drafted",
    }

    logger.info("Writing application draft to MS1: match_id=%s", match_id)

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(url, json=payload, headers=_HEADERS)
        resp.raise_for_status()
        return resp.json()


def fetch_match_by_id(match_id: str) -> dict[str, Any]:
    """
    GET a single match row from MS1 /matches/:id.

    Used by the drafting route to resolve posting_id, posting source_url,
    and user profile from a match_id before starting Playwright.

    Raises httpx.HTTPError on failure.
    """
    url = f"{MS1_INTERNAL_URL}/internal/matches/{match_id}"

    logger.info("Fetching match %s from MS1", match_id)

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.get(url, headers=_HEADERS)
        resp.raise_for_status()
        return resp.json()


def fetch_posting_by_id(posting_id: str) -> dict[str, Any]:
    """
    GET a single posting row from MS1 /postings/:id.

    Used by the drafting route to get the posting's source_url, title,
    and company for Playwright navigation and Gemini context.

    Raises httpx.HTTPError on failure.
    """
    url = f"{MS1_INTERNAL_URL}/postings/{posting_id}"

    logger.info("Fetching posting %s from MS1", posting_id)

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.get(url, headers=_HEADERS)
        resp.raise_for_status()
        return resp.json()


def fetch_profile_by_user_id(user_id: str) -> dict[str, Any] | None:
    """
    GET the profile for a user from MS1 /internal/profiles/:userId.

    Returns the profile row or None if not found.
    Raises httpx.HTTPError on network failures.
    """
    url = f"{MS1_INTERNAL_URL}/internal/profiles/{user_id}"

    logger.info("Fetching profile for user_id=%s from MS1", user_id)

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.get(url, headers=_HEADERS)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()
