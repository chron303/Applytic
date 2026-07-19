const BASE_URL = "/api";

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed");
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