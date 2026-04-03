const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.20.76:8000";

export const apiClient = async (
  endpoint: string,
  options: RequestInit = {},
) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("aliss_token") : null;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only inject application/json if we are NOT transmitting multipart FormData. (Browser computes multipart boundary natively)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.error("Authentication failed. Token missing or expired.");
    if (typeof window !== "undefined") {
      localStorage.removeItem("aliss_token");
      localStorage.removeItem("aliss_token_expires");
      window.location.href = "/"; // Force redirect to login
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};