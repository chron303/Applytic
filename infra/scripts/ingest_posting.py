#!/usr/bin/env python3
"""
ingest_postings.py

Fetches job postings from Greenhouse and Lever public board APIs, extracts
structured requirements from each posting's description using Gemini, and
emits SQL INSERT statements matching the `postings` / `requirements` schema.

Usage
-----
    export GEMINI_API_KEY="..."
    python ingest_postings.py \
        --greenhouse airbnb,stripe \
        --lever netflix,figma \
        --limit 20 \
        --output postings.sql

Dependencies
------------
    pip install requests google-generativeai

Notes
-----
- This script only performs read (GET) requests against the public,
  unauthenticated Greenhouse/Lever board APIs -- no credentials needed there.
- Gemini is used purely for extraction; the schema/field names it's asked to
  emit map directly onto `requirements.structured_data` /
  `requirements.confidence_score`.
- All SQL string/JSON values are escaped before being inlined. If you have a
  live DB connection available, prefer psycopg2 parameterized execution
  instead of the text-based SQL this script prints -- it's provided as text
  so you can review / pipe it into `psql` by hand.
- Verify the Gemini model name (--gemini-model) against Google's current
  documentation before running; model availability changes over time.
"""

import argparse
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import requests

try:
    import google.generativeai as genai
except ImportError:
    genai = None


GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
GREENHOUSE_JOB_URL = "https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}"
LEVER_URL = "https://api.lever.co/v0/postings/{company}?mode=json"

REQUEST_TIMEOUT = 20


# --------------------------------------------------------------------------
# Normalized posting representation
# --------------------------------------------------------------------------

@dataclass
class NormalizedPosting:
    source: str
    external_id: str
    company: str
    title: str
    location: Optional[str]
    employment_type: Optional[str]
    remote: Optional[bool]
    raw_description: Optional[str]
    source_url: Optional[str]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


# --------------------------------------------------------------------------
# Fetchers
# --------------------------------------------------------------------------

def fetch_greenhouse(company: str, limit: int, session: requests.Session) -> list[NormalizedPosting]:
    """Fetch postings for a Greenhouse board token, then fetch each job's
    full content (the list endpoint doesn't include description text)."""
    postings: list[NormalizedPosting] = []
    resp = session.get(GREENHOUSE_URL.format(company=company), timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    jobs = resp.json().get("jobs", [])[:limit]

    for job in jobs:
        job_id = job.get("id")
        description = None
        try:
            detail_resp = session.get(
                GREENHOUSE_JOB_URL.format(company=company, job_id=job_id),
                timeout=REQUEST_TIMEOUT,
            )
            detail_resp.raise_for_status()
            description = detail_resp.json().get("content")
        except requests.RequestException as exc:
            print(f"  [warn] greenhouse detail fetch failed for job {job_id}: {exc}", file=sys.stderr)

        location = (job.get("location") or {}).get("name")
        postings.append(
            NormalizedPosting(
                source="greenhouse",
                external_id=str(job_id),
                company=company,
                title=job.get("title", ""),
                location=location,
                employment_type=None,  # not reliably present in Greenhouse payload
                remote=_guess_remote(location, job.get("title", "")),
                raw_description=description,
                source_url=job.get("absolute_url"),
            )
        )
    return postings


def fetch_lever(company: str, limit: int, session: requests.Session) -> list[NormalizedPosting]:
    postings: list[NormalizedPosting] = []
    resp = session.get(LEVER_URL.format(company=company), timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    jobs = resp.json()[:limit]

    for job in jobs:
        categories = job.get("categories", {}) or {}
        location = categories.get("location")
        description = job.get("descriptionPlain") or job.get("description")
        postings.append(
            NormalizedPosting(
                source="lever",
                external_id=str(job.get("id")),
                company=company,
                title=job.get("text", ""),
                location=location,
                employment_type=categories.get("commitment"),
                remote=_guess_remote(location, job.get("text", "")),
                raw_description=description,
                source_url=job.get("hostedUrl"),
            )
        )
    return postings


def _guess_remote(location: Optional[str], title: str) -> Optional[bool]:
    haystack = f"{location or ''} {title}".lower()
    if "remote" in haystack:
        return True
    return None  # unknown, don't assume on-site


# --------------------------------------------------------------------------
# Gemini extraction
# --------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are extracting structured hiring requirements from a job posting.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly this shape:

{{
  "required_skills": [string],
  "preferred_skills": [string],
  "min_years_experience": number | null,
  "education": string | null,
  "certifications": [string],
  "seniority_level": string | null,
  "key_responsibilities": [string],
  "salary_range": string | null
}}

For every top-level field above, also include a parallel confidence score
(0.0-1.0) in a second JSON object reflecting how explicitly the posting
stated that field. Return your full answer as a single JSON object with two
keys: "structured_data" and "confidence_score", where confidence_score has
the same keys as structured_data.

Job title: {title}
Company: {company}

Job description:
---
{description}
---
"""


def extract_requirements(
    posting: NormalizedPosting,
    model,
    sleep_seconds: float,
) -> Optional[dict[str, Any]]:
    if not posting.raw_description:
        return None

    prompt = EXTRACTION_PROMPT.format(
        title=posting.title,
        company=posting.company,
        description=posting.raw_description[:12000],  # keep prompt bounded
    )

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Strip accidental markdown fences if the model adds them anyway.
        if text.startswith("```"):
            text = text.strip("`")
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.lower().startswith("json"):
                text = text[4:]
        parsed = json.loads(text)
    except (json.JSONDecodeError, AttributeError, Exception) as exc:  # noqa: BLE001
        print(f"  [warn] Gemini extraction failed for {posting.company}/{posting.external_id}: {exc}", file=sys.stderr)
        return None
    finally:
        if sleep_seconds:
            time.sleep(sleep_seconds)

    return parsed


# --------------------------------------------------------------------------
# SQL generation
# --------------------------------------------------------------------------

def sql_literal(value: Any) -> str:
    """Render a Python value as a SQL literal, escaping single quotes."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def posting_insert_sql(p: NormalizedPosting) -> str:
    cols = [
        "id", "source", "external_id", "company", "title", "location",
        "employment_type", "remote", "raw_description", "source_url",
        "status", "last_seen_at",
    ]
    vals = [
        sql_literal(p.id),
        sql_literal(p.source),
        sql_literal(p.external_id),
        sql_literal(p.company),
        sql_literal(p.title),
        sql_literal(p.location),
        sql_literal(p.employment_type),
        sql_literal(p.remote),
        sql_literal(p.raw_description),
        sql_literal(p.source_url),
        sql_literal("active"),
        "now()",
    ]
    return (
        f"INSERT INTO postings ({', '.join(cols)})\n"
        f"VALUES ({', '.join(vals)})\n"
        "ON CONFLICT (source, external_id) DO UPDATE SET\n"
        "  title = EXCLUDED.title,\n"
        "  location = EXCLUDED.location,\n"
        "  employment_type = EXCLUDED.employment_type,\n"
        "  remote = EXCLUDED.remote,\n"
        "  raw_description = EXCLUDED.raw_description,\n"
        "  source_url = EXCLUDED.source_url,\n"
        "  status = 'active',\n"
        "  last_seen_at = now(),\n"
        "  updated_at = now()\n"
        "RETURNING id;"
    )


def requirements_insert_sql(posting_id: str, extraction: dict[str, Any], parser_version: str) -> str:
    structured_data = extraction.get("structured_data")
    confidence_score = extraction.get("confidence_score")
    cols = ["id", "posting_id", "structured_data", "parser_version", "confidence_score"]
    vals = [
        sql_literal(str(uuid.uuid4())),
        sql_literal(posting_id),
        sql_literal(structured_data),
        sql_literal(parser_version),
        sql_literal(confidence_score),
    ]
    return (
        f"INSERT INTO requirements ({', '.join(cols)})\n"
        f"VALUES ({', '.join(vals)})\n"
        "ON CONFLICT (posting_id) DO UPDATE SET\n"
        "  structured_data = EXCLUDED.structured_data,\n"
        "  parser_version = EXCLUDED.parser_version,\n"
        "  confidence_score = EXCLUDED.confidence_score,\n"
        "  updated_at = now();"
    )


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def parse_company_list(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [c.strip() for c in raw.split(",") if c.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--greenhouse", type=str, default="", help="Comma-separated Greenhouse board tokens (e.g. 'airbnb,stripe')")
    parser.add_argument("--lever", type=str, default="", help="Comma-separated Lever company slugs (e.g. 'netflix,figma')")
    parser.add_argument("--limit", type=int, default=10, help="Max postings to fetch per company (N)")
    parser.add_argument("--output", type=str, default="postings.sql", help="Output SQL file path")
    parser.add_argument("--gemini-model", type=str, default="gemini-3.1-flash-lite", help="Gemini model name (verify current availability)")
    parser.add_argument("--gemini-sleep", type=float, default=1.0, help="Seconds to sleep between Gemini calls (rate limiting)")
    parser.add_argument("--skip-extraction", action="store_true", help="Skip Gemini extraction; only emit posting inserts")
    args = parser.parse_args()

    greenhouse_companies = parse_company_list(args.greenhouse)
    lever_companies = parse_company_list(args.lever)

    if not greenhouse_companies and not lever_companies:
        parser.error("Provide at least one of --greenhouse or --lever")

    if not args.skip_extraction:
        if genai is None:
            sys.exit("google-generativeai is not installed. Run: pip install google-generativeai")
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            sys.exit("GEMINI_API_KEY environment variable is not set.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(args.gemini_model)
    else:
        model = None

    session = requests.Session()
    session.headers.update({"User-Agent": "postings-ingest-script/1.0"})

    all_postings: list[NormalizedPosting] = []

    for company in greenhouse_companies:
        print(f"Fetching Greenhouse postings for '{company}'...", file=sys.stderr)
        try:
            all_postings.extend(fetch_greenhouse(company, args.limit, session))
        except requests.RequestException as exc:
            print(f"  [error] failed to fetch greenhouse/{company}: {exc}", file=sys.stderr)

    for company in lever_companies:
        print(f"Fetching Lever postings for '{company}'...", file=sys.stderr)
        try:
            all_postings.extend(fetch_lever(company, args.limit, session))
        except requests.RequestException as exc:
            print(f"  [error] failed to fetch lever/{company}: {exc}", file=sys.stderr)

    print(f"Fetched {len(all_postings)} postings total.", file=sys.stderr)

    sql_statements: list[str] = ["BEGIN;", ""]

    for posting in all_postings:
        sql_statements.append(f"-- {posting.source}/{posting.company}: {posting.title}")
        sql_statements.append(posting_insert_sql(posting))
        sql_statements.append("")

        if not args.skip_extraction:
            print(f"  Extracting requirements: {posting.company} - {posting.title}", file=sys.stderr)
            extraction = extract_requirements(posting, model, args.gemini_sleep)
            if extraction:
                sql_statements.append(
                    requirements_insert_sql(posting.id, extraction, parser_version=f"gemini:{args.gemini_model}")
                )
                sql_statements.append("")

    sql_statements.append("COMMIT;")

    output_text = "\n".join(sql_statements)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(output_text)

    print(f"Wrote SQL for {len(all_postings)} postings to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()