import axios from "axios";

// MS1's base URL from the perspective of MS2
const MS1_INTERNAL_URL = process.env.MS1_INTERNAL_URL || "http://localhost:3000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "default_internal_key";

const internalClient = axios.create({
  baseURL: MS1_INTERNAL_URL,
  headers: {
    "x-internal-api-key": INTERNAL_API_KEY,
    "Content-Type": "application/json",
  },
});

export async function savePostingRequirements(
  postingId: string,
  structuredData: any,
  parserVersion: string,
  confidenceScore: any
) {
  const response = await internalClient.post("/internal/requirements", {
    posting_id: postingId,
    structured_data: structuredData,
    parser_version: parserVersion,
    confidence_score: confidenceScore,
  });
  return response.data;
}

export async function saveMatchResult(
  userId: string,
  postingId: string,
  matchScore: number,
  matchResult: string,
  reasoning: string
) {
  const response = await internalClient.post("/internal/matches", {
    user_id: userId,
    posting_id: postingId,
    match_score: matchScore,
    match_result: matchResult,
    reasoning: reasoning,
  });
  return response.data;
}

export async function saveDraftedApplication(
  matchId: string,
  draftedFields: any
) {
  const response = await internalClient.post("/internal/applications", {
    match_id: matchId,
    drafted_fields: draftedFields,
    status: "drafted",
  });
  return response.data;
}
