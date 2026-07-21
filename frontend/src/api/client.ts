import { ApiError } from "./errorMessages";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const AGENT_BASE_URL = import.meta.env.VITE_AGENT_BASE_URL || "/agent";

function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getAccessToken();

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Don't set Content-Type for FormData.
  // The browser will automatically add the correct multipart boundary.
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      throw new ApiError(response.status, "Request failed");
    }
    throw err;
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message || data?.error || "Request failed");
  }

  return data;
}

async function agentRequest(path: string, options: RequestInit = {}) {
  const token = getAccessToken();

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(`${AGENT_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      throw new ApiError(response.status, "Request failed");
    }
    throw err;
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message || data?.error || "Request failed");
  }

  return data;
}

export const api = {
  post: (path: string, body: unknown) =>
    request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  get: (path: string) =>
    request(path, {
      method: "GET",
    }),

  patch: (path: string, body: unknown) =>
    request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const agentApi = {
  post: (path: string, body: unknown) =>
    agentRequest(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  get: (path: string) =>
    agentRequest(path, {
      method: "GET",
    }),

  patch: (path: string, body: unknown) =>
    agentRequest(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};