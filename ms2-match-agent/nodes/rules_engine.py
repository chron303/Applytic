"""
nodes/rules_engine.py

Deterministic, LLM-free gate. Evaluates a parsed resume (profile data)
against a posting's structured requirements (structured_data JSONB from the
requirements table) and returns a verdict of 'apply', 'maybe', or 'skip',
plus the specific requirement that drove the decision.

This node MUST NEVER call an LLM. It is the hallucination-proof gate
described in the PRD. Every decision here is traceable to a hard rule.

Verdict semantics
-----------------
- 'skip'  : at least one hard-fail criterion not met. Include the
            failing field in `disqualifier`.
- 'maybe' : no hard fails, but one or more soft signals are marginal.
- 'apply' : all criteria satisfied with clear margin.

Fields evaluated from requirements.structured_data
---------------------------------------------------
  required_skills         list[str]   - candidate must cover >= 60 %
  min_years_experience    int | null  - years derived from resume experience
  salary_range            str | null  - parsed for floor; skip if below
  seniority_level         str | null  - cross-checked against resume title
  education               str | null  - informational; not a hard fail here

Fields read from parsed_resume (profile.parsed_data)
------------------------------------------------------
  skills          list[str]
  experience      list[{role, company, start_date, end_date}]
  salary_expectation  str | null  (optional field on profile)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

# Thresholds — easy to tune without touching logic
SKILLS_PASS_THRESHOLD = 0.60      # 60 % required skills covered → pass
SKILLS_MAYBE_THRESHOLD = 0.35     # 35-59 % → maybe
EXPERIENCE_TOLERANCE_YEARS = 1    # within 1 yr under min → maybe, not skip


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise(skill: str) -> str:
    """Lower-case, strip punctuation, collapse whitespace."""
    return re.sub(r"[^\w\s]", "", skill.lower()).strip()


def _skill_matched(required_norm: str, resume_norm_set: set[str]) -> bool:
    """
    Return True if *any* resume skill token satisfies the required skill phrase.

    Matching is bidirectional and case-insensitive (both sides have already
    been lower-cased by _normalise):
      - Forward  : resume token is a substring of the required phrase
                   e.g. "python" in "backend programming java kotlin scala or python"
      - Backward : required phrase is a substring of a resume token
                   e.g. "sql" in "postgresql sql"

    This handles LLM-extracted descriptive phrases (which bundle multiple
    technologies) vs. short atomic resume skill tags.
    """
    for resume_skill in resume_norm_set:
        if resume_skill in required_norm or required_norm in resume_skill:
            return True
    return False


def _compute_total_years_experience(experience: list[dict]) -> float:
    """
    Sum months across all experience entries, return decimal years.
    Handles 'present' / 'current' end dates. Returns 0.0 on parse failure.
    """
    total_months: float = 0.0
    now = datetime.now()

    for entry in experience:
        start_raw = str(entry.get("start_date", "") or "").strip()
        end_raw_orig = str(entry.get("end_date", "") or "").strip()
        end_raw_lower = end_raw_orig.lower()

        start_dt = _parse_date(start_raw, default=None)
        if start_dt is None:
            continue

        if end_raw_lower in ("present", "current", "now", ""):
            end_dt = now
        else:
            end_dt = _parse_date(end_raw_orig, default=now)

        delta_months = (
            (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month)
        )
        total_months += max(0, delta_months)

    return round(total_months / 12, 1)


def _parse_date(raw: str, default: datetime | None) -> datetime | None:
    """Try several common date formats; return `default` on failure."""
    formats = [
        "%Y-%m-%d", "%m/%Y", "%Y", "%B %Y", "%b %Y",
        "%m-%Y", "%Y/%m", "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return default


def _parse_salary_floor_from_range(salary_range: str) -> float | None:
    """
    Extract the lower bound of a salary string like:
      "$120,000 – $150,000"  "€61.000 - €72.000 EUR"  "100k-130k"
    Returns None if unparseable.
    """
    # Strip currency symbols and letters, keep digits, dots, commas, dashes
    cleaned = re.sub(r"[^\d.,\-–]", " ", salary_range)
    # Normalise European decimal dots and thousand-separators
    parts = re.split(r"[\-–]", cleaned)
    for part in parts:
        part = part.replace(",", "").replace(".", "").strip()
        try:
            value = float(part)
            if value > 0:
                # Handle shorthand like "120" meaning 120,000
                return value if value > 1000 else value * 1000
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate(
    parsed_resume: dict[str, Any],
    structured_requirements: dict[str, Any],
) -> dict[str, Any]:
    """
    Evaluate a resume against a posting's structured requirements.

    Returns a dict with keys:
        verdict      : 'apply' | 'maybe' | 'skip'
        score        : float 0.0-100.0  (skill coverage %)
        disqualifier : str | None       (name of the first hard-failing field)
        signals      : dict             (per-field evaluation detail)
    """
    signals: dict[str, Any] = {}

    # ---- 1. Skills coverage --------------------------------------------
    required_skills: list[str] = structured_requirements.get("required_skills") or []
    logger.warning("DEBUG required_skills type=%s value=%r", type(required_skills), required_skills)
    resume_skills: list[str] = parsed_resume.get("skills") or []

    norm_resume = {_normalise(s) for s in resume_skills if isinstance(s, str)}
    norm_required = [_normalise(s) for s in required_skills if isinstance(s, str)]

    if norm_required:
        matched = [s for s in norm_required if _skill_matched(s, norm_resume)]
        skill_coverage = len(matched) / len(norm_required)
        signals["skills"] = {
            "coverage": round(skill_coverage, 3),
            "matched": matched,
            "missing": [s for s in norm_required if not _skill_matched(s, norm_resume)],
        }
    else:
        skill_coverage = 1.0
        signals["skills"] = {"coverage": 1.0, "matched": [], "missing": []}

    score = round(skill_coverage * 100, 1)

    # Hard fail on skills
    if skill_coverage < SKILLS_MAYBE_THRESHOLD:
        return {
            "verdict": "skip",
            "score": score,
            "disqualifier": "required_skills",
            "signals": signals,
        }

    # ---- 2. Years of experience ----------------------------------------
    min_years = structured_requirements.get("min_years_experience")
    experience: list[dict] = parsed_resume.get("experience") or []
    actual_years = _compute_total_years_experience(experience)
    signals["experience"] = {"actual_years": actual_years, "required": min_years}

    experience_verdict = "ok"
    if min_years is not None:
        try:
            min_years_f = float(min_years)
            gap = min_years_f - actual_years
            if gap > EXPERIENCE_TOLERANCE_YEARS:
                # Hard fail — too far under the minimum
                return {
                    "verdict": "skip",
                    "score": score,
                    "disqualifier": "min_years_experience",
                    "signals": signals,
                }
            elif gap > 0:
                experience_verdict = "marginal"
        except (TypeError, ValueError):
            pass  # unparseable requirement — don't penalise

    signals["experience"]["verdict"] = experience_verdict

    # ---- 3. Salary floor -----------------------------------------------
    salary_range: str | None = structured_requirements.get("salary_range")
    salary_expectation_raw: str | None = parsed_resume.get("salary_expectation")
    salary_verdict = "ok"

    if salary_range and salary_expectation_raw:
        floor = _parse_salary_floor_from_range(salary_range)
        candidate_floor = _parse_salary_floor_from_range(salary_expectation_raw)
        signals["salary"] = {
            "posting_floor": floor,
            "candidate_expectation": candidate_floor,
        }
        if floor is not None and candidate_floor is not None:
            if candidate_floor > floor * 1.25:
                # Candidate expects significantly more than ceiling — skip
                return {
                    "verdict": "skip",
                    "score": score,
                    "disqualifier": "salary_range",
                    "signals": signals,
                }
            elif candidate_floor > floor * 1.10:
                salary_verdict = "marginal"
    else:
        signals["salary"] = {"verdict": "not_evaluated"}

    # ---- 4. Assemble final verdict ------------------------------------
    any_marginal = (
        skill_coverage < SKILLS_PASS_THRESHOLD
        or experience_verdict == "marginal"
        or salary_verdict == "marginal"
    )

    verdict = "maybe" if any_marginal else "apply"

    return {
        "verdict": verdict,
        "score": score,
        "disqualifier": None,
        "signals": signals,
    }


def run_rules_engine(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node wrapper. Reads per-posting state keys and writes
    `rules_verdict` back.

    Expects on state:
        parsed_resume        dict  (profile.parsed_data)
        current_posting      dict  (postings row)
        current_requirements dict  (requirements.structured_data)

    Writes to state:
        rules_verdict   dict  (output of evaluate())
    """
    parsed_resume = state.get("parsed_resume") or {}
    structured_requirements = state.get("current_requirements") or {}

    try:
        verdict = evaluate(parsed_resume, structured_requirements)
    except Exception as exc:
        logger.exception("rules_engine failed: %s", exc)
        verdict = {
            "verdict": "skip",
            "score": 0.0,
            "disqualifier": "rules_engine_error",
            "signals": {"error": str(exc)},
        }

    state["rules_verdict"] = verdict
    return state
