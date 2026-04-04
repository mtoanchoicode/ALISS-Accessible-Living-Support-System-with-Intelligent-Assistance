const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const apiClient = async (
  endpoint: string,
  options: RequestInit = {},
) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("aliss_token") : null;

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
    const errText = await response.text();
    console.error("Authentication failed 401:", errText);
    if (typeof window !== "undefined") {
      alert("ALISS API 401 Unauthorized Error: " + errText);
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
