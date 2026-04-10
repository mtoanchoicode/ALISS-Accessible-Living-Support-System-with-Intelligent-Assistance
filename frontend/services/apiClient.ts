const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://qty-smoking-ext-carpet.trycloudflare.com";

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
      console.log("ALISS API 401 Unauthorized Error: " + errText);
      localStorage.removeItem("aliss_token");
      window.location.href = "/";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
