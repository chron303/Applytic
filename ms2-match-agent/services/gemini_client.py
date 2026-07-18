"""
Thin wrapper around the Gemini client.

Nothing in this file knows anything about PDFs, resumes, or FastAPI —
on purpose. Right now its only job is proving MS2 can successfully
authenticate to Gemini and get a response back. Resume-parsing logic
will live in its own module later and will import get_gemini_client()
from here, rather than creating its own client.
"""

from google import genai

from config import GEMINI_MODEL, require_gemini_api_key

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    """
    Returns the shared Gemini client instance.

    Creates the client lazily on first use so importing this module
    doesn't require GEMINI_API_KEY to already be configured.
    """
    global _client

    if _client is None:
        _client = genai.Client(api_key=require_gemini_api_key())

    return _client


def test_gemini() -> None:
    """
    Sends a single test prompt to Gemini and prints the response.

    This function proves exactly one thing: that GEMINI_API_KEY is
    valid and MS2 can successfully reach the Gemini API. It does not
    parse anything, store anything, or touch FastAPI — that's
    intentional, per the task scope.
    """
    print("Using Gemini model:", GEMINI_MODEL)

    client = get_gemini_client()

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents="Hello Gemini",
    )

    print(response.text)


if __name__ == "__main__":
    test_gemini()