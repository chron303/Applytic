import { api } from "./client";

export async function getDashboardCounts(): Promise<Record<string, number>> {
  return api.get("/dashboard");
}
