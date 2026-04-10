
import { getSessionToken, logoutAction } from "@/app/actions/auth";

const BASE_URL = "https://qty-smoking-ext-carpet.trycloudflare.com";

export const apiClient = async (
  endpoint: string,
  options: RequestInit = {},
) => {
  let token = null;
  try {
    // This Server Action fetches the access token from the secure Supabase HttpOnly cookie.
    // It automatically performs a silent token refresh in the background if the session is expired.
    token = await getSessionToken();
  } catch (e) {
    console.warn("Failed to get session token", e);
  }

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If the token is still rejected by FastAPI (e.g. revoked manually or out of sync),
    // attempt a second refresh fetch just in case before failing.
    try {
      token = await getSessionToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        response = await fetch(`${BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    } catch {}

    if (response.status === 401) {
      const errText = await response.text();
      console.error("Authentication failed 401:", errText);
      if (typeof window !== "undefined") {
        console.log("ALISS API 401 Unauthorized Error: " + errText);
        await logoutAction();
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
