import { api, agentApi } from "./client";

export interface Application {
  id: string;
  match_id: string;
  drafted_fields?: any;
  source_url?: string;
  title?: string;
  company?: string;
  status: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export async function getApplications(status?: string): Promise<Application[]> {
  const query = status ? `?status=${status}` : "";
  return await api.get(`/applications${query}`);
}

export async function getApplication(id: string): Promise<Application> {
  return await api.get(`/applications/${id}`);
}

export async function draftApplication(match_id: string) {
  return await agentApi.post("/draft-application", { match_id });
}

export async function updateApplicationField(id: string, updates: any): Promise<Application> {
  return await api.patch(`/applications/${id}`, updates);
}

export async function approveApplication(id: string): Promise<Application> {
  return await api.post(`/applications/${id}/approve`, {});
}
