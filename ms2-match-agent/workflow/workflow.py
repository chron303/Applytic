"""
workflow/workflow.py

Three compiled LangGraph graphs live here:

1. get_resume_workflow()
   Original straight-line pipeline:
     START -> parse_resume -> parse_job -> match_skills
           -> generate_recommendations -> END
   Kept unchanged for backward-compat with POST /parse-resume.

2. get_match_workflow()
   New per-posting pipeline:
     START -> run_rules_engine -> run_match_explainer -> END
   This is the graph /match-profile invokes once per active posting.
   The orchestration (looping over all postings, writing results back
   to MS1) lives in resume_routes.py, not here — this graph is
   stateless and reusable.

3. get_drafting_workflow()
   On-demand drafting pipeline:
     START -> run_drafting_worker -> END
   ONLY invoked explicitly via POST /draft-application when the user
   approves a specific 'apply' match for form drafting. Never run
   automatically during the match sweep.
"""

import logging

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from nodes.drafting_worker import run_drafting_worker
from nodes.gemini_resume_parser import parse_resume
from nodes.job_parser import parse_job
from nodes.match_explainer import run_match_explainer
from nodes.recommendation_generator import generate_recommendations
from nodes.rules_engine import run_rules_engine
from nodes.skill_matcher import match_skills
from state.resume_state import DraftingState, MatchState, ResumeState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Original workflow (unchanged)
# ---------------------------------------------------------------------------

def get_resume_workflow() -> CompiledStateGraph:
    """
    Builds and compiles the original Resume Matching Agent's LangGraph workflow.

    Graph:
        START -> parse_resume -> parse_job ->
        match_skills -> generate_recommendations -> END
    """
    logger.info("Building original resume workflow graph")

    graph_builder: StateGraph = StateGraph(ResumeState)

    graph_builder.add_node("parse_resume", parse_resume)
    graph_builder.add_node("parse_job", parse_job)
    graph_builder.add_node("match_skills", match_skills)
    graph_builder.add_node("generate_recommendations", generate_recommendations)

    graph_builder.add_edge(START, "parse_resume")
    graph_builder.add_edge("parse_resume", "parse_job")
    graph_builder.add_edge("parse_job", "match_skills")
    graph_builder.add_edge("match_skills", "generate_recommendations")
    graph_builder.add_edge("generate_recommendations", END)

    compiled: CompiledStateGraph = graph_builder.compile()
    logger.info("Original resume workflow compiled")
    return compiled


# ---------------------------------------------------------------------------
# New per-posting match workflow
# ---------------------------------------------------------------------------

def get_match_workflow() -> CompiledStateGraph:
    """
    Builds and compiles the per-posting match graph:
        START -> run_rules_engine -> run_match_explainer -> END

    Callers invoke it with a MatchState containing:
        parsed_resume        dict  (profile.parsed_data)
        current_posting      dict  (postings row)
        current_requirements dict  (requirements.structured_data)
        errors               list  (pre-initialised to [])
    """
    logger.info("Building per-posting match workflow graph")

    graph_builder: StateGraph = StateGraph(MatchState)

    graph_builder.add_node("run_rules_engine", run_rules_engine)
    graph_builder.add_node("run_match_explainer", run_match_explainer)

    graph_builder.add_edge(START, "run_rules_engine")
    graph_builder.add_edge("run_rules_engine", "run_match_explainer")
    graph_builder.add_edge("run_match_explainer", END)

    compiled: CompiledStateGraph = graph_builder.compile()
    logger.info("Per-posting match workflow compiled")
    return compiled


# ---------------------------------------------------------------------------
# On-demand drafting workflow (NEVER auto-invoked)
# ---------------------------------------------------------------------------

def get_drafting_workflow() -> CompiledStateGraph:
    """
    Builds and compiles the explicit application-drafting graph:
        START -> run_drafting_worker -> END

    This graph is ONLY invoked when a user explicitly approves a specific
    match for form drafting via POST /draft-application. It is deliberately
    NOT wired into the match sweep so it never fires automatically.

    Callers invoke it with a DraftingState containing:
        source_url       str   (posting.source_url — Greenhouse form URL)
        parsed_resume    dict  (profile.parsed_data from MS1)
        match_reasoning  str   (from match_explainer, for Gemini context)
        posting          dict  (posting row — title/company for Gemini)
        drafted_fields   dict  (pre-initialised to {})
        draft_errors     list  (pre-initialised to [])
    """
    logger.info("Building application drafting workflow graph")

    graph_builder: StateGraph = StateGraph(DraftingState)

    graph_builder.add_node("run_drafting_worker", run_drafting_worker)

    graph_builder.add_edge(START, "run_drafting_worker")
    graph_builder.add_edge("run_drafting_worker", END)

    compiled: CompiledStateGraph = graph_builder.compile()
    logger.info("Application drafting workflow compiled")
    return compiled