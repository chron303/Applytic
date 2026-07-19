import { api } from "./client";

export interface Match {
  id: string;
  user_id: string;
  posting_id: string;
  match_score?: number;
  match_result: 'apply' | 'maybe' | 'skip';
  reasoning?: string;
  created_at: string;
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
  const response = await fetch("/ms2/match-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      parsed_resume: parsedResume,
    }),
  });
  if (!response.ok) {
    throw new Error("Match profile failed");
  }
  return response.json();
}
