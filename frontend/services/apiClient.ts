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
      localStorage.removeItem("aliss_token");
      localStorage.removeItem("aliss_token_expires");
      document.cookie = "aliss_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    console.error(`API Error: [${response.status}] ${response.statusText} at ${BASE_URL}${endpoint}`);
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
