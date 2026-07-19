import { api } from "./client";

export async function getProfile(userId: string) {
  return await api.get(`/profiles/${userId}`);
}
