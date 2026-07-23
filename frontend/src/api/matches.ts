import { api, agentApi } from "./client";

export interface Match {
  id: string;
  user_id: string;
  posting_id: string;
  match_score?: number;
  match_result: 'apply' | 'maybe' | 'skip';
  reasoning?: string;
  created_at: string;
  application_status?: string | null;
}

export interface Posting {
  id: string;
  source: string;
  external_id: string;
  company: string;
  title: string;
  location?: string;
  employment_type?: string;
  remote?: boolean;
  status: string;
}

export async function getMatches(): Promise<Match[]> {
  return await api.get("/matches?limit=100");
}

export async function getPostings(): Promise<Posting[]> {
  return await api.get("/postings?limit=100");
}

export async function matchProfile(userId: string, parsedResume: any) {
  return await agentApi.post("/match-profile", {
    user_id: userId,
    parsed_resume: parsedResume,
  });
}
