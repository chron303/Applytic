"""
nodes/drafting_worker.py

Playwright-based Greenhouse application form drafter.

Scope (MVP / PRD §Draft-only):
  - ONE Greenhouse form layout (the standard `boards.greenhouse.io` job
    application page).
  - NO live submission — the submit button is never clicked.
  - NO vision fallback — selectors only.
  - Free-text fields (cover letter, "why this role") are drafted via
    Gemini but remain in-memory; the caller decides what to persist.
  - Each mapped field carries a confidence score:
      1.0  – direct structured match (e.g. profile.email → email field)
      0.8  – inferred match with high confidence (e.g. first name from
              full_name split)
      0.5  – heuristic / label-proximity match (field found by label
              text similarity, value might be approximate)
      0.3  – free-text draft by LLM (always user-reviewable)
      0.0  – field detected but unmappable / no profile data available

Public API:
  run_drafting_worker(state: dict) -> dict
    LangGraph node. Expects state keys:
      source_url       str   (posting.source_url)
      parsed_resume    dict  (profile.parsed_data)
      match_reasoning  str   (from match_explainer)
      posting          dict  (posting row, for title/company context)
    Writes to state:
      drafted_fields   dict  (field_name -> {value, confidence, note})
      draft_errors     list  (per-field error strings)
"""

from __future__ import annotations

import logging
import re
from typing import Any

from google.genai import types
from playwright.sync_api import Page, sync_playwright

from config import GEMINI_MODEL
from services.gemini_client import get_gemini_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Greenhouse standard DOM selectors
# Tested against the canonical boards.greenhouse.io application form.
# Each entry: (field_key, selector, confidence_if_found, value_strategy)
# value_strategy is referenced in _fill_field() below.
# ---------------------------------------------------------------------------

_STANDARD_FIELDS: list[tuple[str, str, float, str]] = [
    # field_key                selector                                          confidence  strategy
    ("first_name",   "#first_name",                                              0.8,        "split_full_name_first"),
    ("last_name",    "#last_name",                                               0.8,        "split_full_name_last"),
    ("email",        "#email",                                                   1.0,        "direct:email"),
    ("phone",        "#phone",                                                   1.0,        "direct:phone"),
    ("resume_url",   "input[type='file'][name*='resume']",                       0.9,        "skip_file"),  # can't fill file inputs headlessly
    ("linkedin",     "input[id*='linkedin'], input[name*='linkedin']",           0.8,        "direct:linkedin"),
    ("website",      "input[id*='website'], input[id*='portfolio']",             0.8,        "direct:website"),
    ("cover_letter", "textarea[id*='cover_letter'], textarea[name*='cover']",    0.3,        "gemini_freetext:cover_letter"),
    # EEO / demographic questions — treat as informational; never pre-fill
    ("gender",       "select[id*='gender']",                                     0.0,        "eeo_skip"),
    ("race",         "select[id*='race'], select[id*='ethnicity']",              0.0,        "eeo_skip"),
    ("disability",   "select[id*='disability'], input[id*='disability']",        0.0,        "eeo_skip"),
    ("veteran",      "select[id*='veteran'], input[id*='veteran']",              0.0,        "eeo_skip"),
]

# Additional generic labels to scan when standard IDs don't match
_LABEL_HEURISTICS: list[tuple[str, str, float]] = [
    ("why_role",    r"why.*role|why.*interest|motivation|tell us why",           0.3),
    ("experience",  r"relevant experience|years of experience",                  0.3),
    ("salary",      r"salary expectation|desired salary|compensation",           0.5),
    ("location",    r"current location|city.*state|where.*based",               0.5),
]

_GEMINI_DRAFT_PROMPT = """
You are drafting a short, professional cover letter section for a job application.
Use the candidate's background and the match reasoning to write ONE focused paragraph
(max 120 words). Be specific — name the role and company, cite 1-2 concrete skills or
achievements from the profile. Write in first person.

Role: {title} at {company}
Match reasoning: {reasoning}

Candidate profile summary:
{summary}

Key skills: {skills}

Write ONLY the paragraph text. No greeting, no sign-off, no markdown.
""".strip()

_GEMINI_WHY_PROMPT = """
Write a concise answer (max 80 words) to "Why are you interested in this role?"
for a job application. Ground it in the candidate's actual experience and the match
reasoning. First person, professional, no filler phrases.

Role: {title} at {company}
Match reasoning: {reasoning}
Candidate skills: {skills}

Write ONLY the answer text. No markdown.
""".strip()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_value(
    strategy: str,
    profile: dict[str, Any],
    context: dict[str, Any],
) -> tuple[str | None, float]:
    """
    Resolve the profile value for a given fill strategy.
    Returns (value_or_None, effective_confidence).
    """
    if strategy == "skip_file":
        return None, 0.0

    if strategy == "eeo_skip":
        return None, 0.0

    if strategy.startswith("direct:"):
        key = strategy.split(":", 1)[1]
        val = profile.get(key) or ""
        return (str(val) if val else None), (1.0 if val else 0.0)

    if strategy == "split_full_name_first":
        full = str(profile.get("full_name") or "").strip()
        parts = full.split(" ", 1)
        val = parts[0] if parts else None
        return val, (0.8 if val else 0.0)

    if strategy == "split_full_name_last":
        full = str(profile.get("full_name") or "").strip()
        parts = full.split(" ", 1)
        val = parts[1] if len(parts) > 1 else None
        return val, (0.8 if val else 0.0)

    if strategy.startswith("gemini_freetext:"):
        kind = strategy.split(":", 1)[1]
        val = _draft_freetext(kind, profile, context)
        return val, (0.3 if val else 0.0)

    return None, 0.0


def _draft_freetext(
    kind: str,
    profile: dict[str, Any],
    context: dict[str, Any],
) -> str | None:
    """Call Gemini to draft a free-text field. Returns None on any failure."""
    title = context.get("title", "the role")
    company = context.get("company", "the company")
    reasoning = context.get("reasoning", "")
    skills = ", ".join((profile.get("skills") or [])[:10])
    summary = profile.get("summary") or ""

    if kind == "cover_letter":
        prompt = _GEMINI_DRAFT_PROMPT.format(
            title=title, company=company, reasoning=reasoning,
            summary=summary, skills=skills,
        )
    elif kind == "why_role":
        prompt = _GEMINI_WHY_PROMPT.format(
            title=title, company=company, reasoning=reasoning, skills=skills,
        )
    else:
        return None

    client = get_gemini_client()
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=200,
            ),
        )
        text = (response.text or "").strip()
        return text if text else None
    except Exception as exc:
        logger.warning("Gemini free-text draft failed for '%s': %s", kind, exc)
        return None


def _scan_label_heuristics(
    page: Page,
    profile: dict[str, Any],
    context: dict[str, Any],
    drafted: dict[str, Any],
    errors: list[str],
) -> None:
    """
    Walk all visible labels, check each against _LABEL_HEURISTICS patterns,
    and attempt to fill the associated input/textarea if the standard pass
    didn't already cover it.
    """
    labels = page.locator("label").all()
    for label in labels:
        try:
            label_text = (label.inner_text() or "").lower().strip()
        except Exception:
            continue

        for field_key, pattern, confidence in _LABEL_HEURISTICS:
            if field_key in drafted:
                continue
            if not re.search(pattern, label_text, re.IGNORECASE):
                continue

            # Try to find the associated input/textarea via `for` attribute
            for_attr = label.get_attribute("for") or ""
            locator = None
            if for_attr:
                locator = page.locator(f"#{for_attr}").first
            else:
                # Try sibling or child
                locator = label.locator("xpath=following-sibling::*[self::input or self::textarea][1]").first

            if locator is None:
                continue

            try:
                if not locator.is_visible():
                    continue
            except Exception:
                continue

            # Resolve a value for this heuristic field
            if "gemini" in pattern or field_key in ("why_role", "cover_letter"):
                val, eff_conf = _draft_freetext(field_key, profile, context), confidence
            elif field_key == "salary":
                raw = profile.get("salary_expectation") or ""
                val, eff_conf = (str(raw) if raw else None), confidence
            elif field_key == "location":
                # Build from last experience entry's context — best effort
                experience = profile.get("experience") or []
                val = None
                if experience:
                    last = experience[-1]
                    val = last.get("company", "") or None
                eff_conf = confidence if val else 0.0
            else:
                val, eff_conf = None, 0.0

            if val:
                try:
                    locator.fill(val)
                    drafted[field_key] = {
                        "value": val,
                        "confidence": eff_conf,
                        "note": f"heuristic match on label '{label_text}'",
                    }
                except Exception as exc:
                    errors.append(f"heuristic fill failed for '{field_key}': {exc}")
            else:
                drafted[field_key] = {
                    "value": None,
                    "confidence": 0.0,
                    "note": f"detected via label '{label_text}' but no profile value",
                }


# ---------------------------------------------------------------------------
# Core Playwright scrape-and-fill
# ---------------------------------------------------------------------------

def draft_application(
    source_url: str,
    profile: dict[str, Any],
    context: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """
    Open the Greenhouse application form at `source_url`, detect standard
    fields by DOM selector, map profile data onto them (no submit), draft
    free-text fields via Gemini.

    Args:
        source_url : URL of the job posting application form.
        profile    : Parsed profile data (profile.parsed_data from MS1).
        context    : {title, company, reasoning} for Gemini context.

    Returns:
        (drafted_fields, errors)
          drafted_fields : dict of field_key -> {value, confidence, note}
          errors         : list of per-field failure strings (non-fatal)
    """
    drafted: dict[str, Any] = {}
    errors: list[str] = []

    if not source_url:
        errors.append("source_url is empty; cannot open application form")
        return drafted, errors

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

            logger.info("Opening Greenhouse form: %s", source_url)
            try:
                page.goto(source_url, timeout=30_000, wait_until="domcontentloaded")
            except Exception as exc:
                errors.append(f"page load failed: {exc}")
                browser.close()
                return drafted, errors

            # --- Standard field pass ---
            for field_key, selector, base_confidence, strategy in _STANDARD_FIELDS:
                try:
                    locator = page.locator(selector).first
                    if not locator.is_visible(timeout=2_000):
                        drafted[field_key] = {
                            "value": None,
                            "confidence": 0.0,
                            "note": "field not found in DOM",
                        }
                        continue
                except Exception:
                    drafted[field_key] = {
                        "value": None,
                        "confidence": 0.0,
                        "note": "selector timed out or threw",
                    }
                    continue

                value, effective_confidence = _resolve_value(strategy, profile, context)

                if strategy in ("skip_file", "eeo_skip"):
                    drafted[field_key] = {
                        "value": None,
                        "confidence": 0.0,
                        "note": "intentionally skipped per policy",
                    }
                    continue

                if value is None:
                    drafted[field_key] = {
                        "value": None,
                        "confidence": 0.0,
                        "note": "no profile data for this field",
                    }
                    continue

                try:
                    tag = locator.evaluate("el => el.tagName.toLowerCase()")
                    if tag == "select":
                        # Don't touch EEO selects; this path shouldn't be reached
                        # but guard anyway
                        pass
                    else:
                        locator.fill(value)

                    drafted[field_key] = {
                        "value": value,
                        "confidence": effective_confidence,
                        "note": f"filled via selector '{selector}'",
                    }
                    logger.debug("Filled field '%s' (confidence=%.2f)", field_key, effective_confidence)

                except Exception as exc:
                    errors.append(f"fill failed for '{field_key}': {exc}")
                    drafted[field_key] = {
                        "value": value,
                        "confidence": effective_confidence * 0.5,
                        "note": f"resolved but fill raised: {exc}",
                    }

            # --- Label heuristics pass (for non-standard fields) ---
            _scan_label_heuristics(page, profile, context, drafted, errors)

            browser.close()

    except Exception as exc:
        errors.append(f"Playwright session failed: {exc}")
        logger.exception("Playwright session error for url=%s", source_url)

    return drafted, errors


# ---------------------------------------------------------------------------
# LangGraph node
# ---------------------------------------------------------------------------

def run_drafting_worker(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node wrapper.

    Expects on state:
        source_url       str
        parsed_resume    dict
        match_reasoning  str
        posting          dict  (for title/company)

    Writes to state:
        drafted_fields   dict
        draft_errors     list[str]
    """
    source_url: str = state.get("source_url") or ""
    profile: dict = state.get("parsed_resume") or {}
    reasoning: str = state.get("match_reasoning") or ""
    posting: dict = state.get("posting") or {}

    context = {
        "title": posting.get("title", "the role"),
        "company": posting.get("company", "the company"),
        "reasoning": reasoning,
    }

    drafted, errors = draft_application(source_url, profile, context)

    if errors:
        for err in errors:
            logger.warning("Drafting error: %s", err)

    state["drafted_fields"] = drafted
    state["draft_errors"] = errors
    return state
