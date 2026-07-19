"""
nodes/match_explainer.py

LangGraph node that takes the rules_engine verdict and produces a short,
cited reasoning string via Gemini — matching the PRD example format:
  "5 years backend experience, salary floor met, remote eligible —
   strong match for Senior Backend Engineer."

This node only runs if rules_engine returned 'apply' or 'maybe'. A 'skip'
verdict with a hard disqualifier is already self-explanatory and does not
need an LLM explanation.

Follows the same client pattern as gemini_resume_parser.py:
  - get_gemini_client() from services.gemini_client
  - GEMINI_MODEL from config
  - response_mime_type="text/plain" (reasoning is a short string, not JSON)
"""

from __future__ import annotations

import logging
from typing import Any

# pyrefly: ignore [missing-import]
from google.genai import types

from config import GEMINI_MODEL
from services.gemini_client import get_gemini_client

logger = logging.getLogger(__name__)

_EXPLAIN_PROMPT_TEMPLATE = """
You are a concise job-match analyst. Based on the structured evaluation
below, write ONE sentence of cited reasoning (max 40 words) that explains
why the candidate is a {verdict} for this role. Name specific signals.
End with the role title.

Role: {title} at {company}
Verdict: {verdict}

Rules engine signals:
- Skills coverage: {skill_coverage_pct}% ({matched_count}/{total_required} required skills matched)
  Missing: {missing_skills_summary}
- Experience: {actual_years} years actual vs {required_years} required
- Salary signal: {salary_signal}
- Disqualifier: {disqualifier}

Write ONLY the one-sentence reasoning. No JSON, no markdown, no labels.
""".strip()


def _summarise_skills(signals: dict) -> tuple[str, str, str, str]:
    """Returns (coverage_pct, matched_count, total_required, missing_summary)."""
    skill_signals = signals.get("skills", {})
    coverage = skill_signals.get("coverage", 0.0)
    matched = skill_signals.get("matched", [])
    missing = skill_signals.get("missing", [])
    total = len(matched) + len(missing)
    missing_summary = ", ".join(missing[:5]) or "none"
    return (
        str(round(coverage * 100, 0)),
        str(len(matched)),
        str(total),
        missing_summary,
    )


def _summarise_salary(signals: dict) -> str:
    salary = signals.get("salary", {})
    if salary.get("verdict") == "not_evaluated":
        return "not evaluated"
    floor = salary.get("posting_floor")
    expectation = salary.get("candidate_expectation")
    if floor is None or expectation is None:
        return "not evaluated"
    return f"candidate expects ~{int(expectation):,}, posting floor ~{int(floor):,}"


def explain_match(
    parsed_resume: dict[str, Any],
    posting: dict[str, Any],
    rules_verdict: dict[str, Any],
) -> str:
    """
    Call Gemini to produce a single cited-reasoning sentence.
    Returns a plain string. Never raises — returns a fallback string on error.
    """
    verdict: str = rules_verdict.get("verdict", "maybe")
    signals: dict = rules_verdict.get("signals", {})
    disqualifier: str = rules_verdict.get("disqualifier") or "none"

    skill_coverage_pct, matched_count, total_required, missing_summary = _summarise_skills(signals)

    exp_signals = signals.get("experience", {})
    actual_years = exp_signals.get("actual_years", "unknown")
    required_years = exp_signals.get("required") or "not specified"

    salary_signal = _summarise_salary(signals)

    prompt = _EXPLAIN_PROMPT_TEMPLATE.format(
        verdict=verdict,
        title=posting.get("title", "the role"),
        company=posting.get("company", "the company"),
        skill_coverage_pct=skill_coverage_pct,
        matched_count=matched_count,
        total_required=total_required,
        missing_skills_summary=missing_summary,
        actual_years=actual_years,
        required_years=required_years,
        salary_signal=salary_signal,
        disqualifier=disqualifier,
    )

    client = get_gemini_client()

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=120,
            ),
        )
        reasoning = (response.text or "").strip()
        if not reasoning:
            reasoning = _fallback_reasoning(verdict, rules_verdict, posting)
    except Exception as exc:
        logger.error("Gemini match_explainer failed: %s", exc)
        reasoning = _fallback_reasoning(verdict, rules_verdict, posting)

    return reasoning


def _fallback_reasoning(
    verdict: str,
    rules_verdict: dict[str, Any],
    posting: dict[str, Any],
) -> str:
    """Deterministic fallback when Gemini is unavailable."""
    disq = rules_verdict.get("disqualifier")
    title = posting.get("title", "this role")
    signals = rules_verdict.get("signals", {})
    score = rules_verdict.get("score", 0)

    if disq:
        return (
            f"Candidate did not meet the {disq} requirement for {title} "
            f"(skill coverage {score}%)."
        )
    skill_signals = signals.get("skills", {})
    coverage = round((skill_signals.get("coverage") or 0) * 100)
    return (
        f"{coverage}% required skills matched, experience and salary within "
        f"range — {verdict} for {title}."
    )


def run_match_explainer(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node wrapper.

    Expects on state:
        parsed_resume     dict
        current_posting   dict   (postings row)
        rules_verdict     dict   (from rules_engine)

    Writes to state:
        match_reasoning   str
    """
    rules_verdict = state.get("rules_verdict") or {}
    verdict = rules_verdict.get("verdict", "skip")

    # 'skip' with a hard disqualifier needs no LLM explanation
    if verdict == "skip" and rules_verdict.get("disqualifier"):
        disq = rules_verdict["disqualifier"]
        posting = state.get("current_posting") or {}
        state["match_reasoning"] = (
            f"Hard disqualifier: {disq} requirement not met for "
            f"{posting.get('title', 'this role')}."
        )
        return state

    reasoning = explain_match(
        parsed_resume=state.get("parsed_resume") or {},
        posting=state.get("current_posting") or {},
        rules_verdict=rules_verdict,
    )

    state["match_reasoning"] = reasoning
    return state
