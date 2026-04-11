// frontend/services/authService.ts
import { apiClient } from "./apiClient";

export const authService = {
  login: async (email: string, password: string) => {
    return apiClient("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (userData: any) => {
    return apiClient("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },
  
  saveToken: (token: string, userId?: string) => {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("aliss_token", token);
    localStorage.setItem("aliss_token_expires", expiresAt.toString());
    if (userId) {
      localStorage.setItem("aliss_user_id", userId);
    }
    document.cookie = `aliss_token=${token}; path=/; max-age=86400; SameSite=Lax`;
  },
  
  getToken: () => {
    const token = localStorage.getItem("aliss_token");
    const expiresAt = localStorage.getItem("aliss_token_expires");

    if (!token || !expiresAt) return null;

    if (Date.now() > parseInt(expiresAt, 10)) {
      authService.clearToken();
      return null;
    }

    return token;
  },

  clearToken: () => {
    localStorage.removeItem("aliss_token");
    localStorage.removeItem("aliss_token_expires");
    localStorage.removeItem("aliss_user_id");
    document.cookie = "aliss_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },

  logout: async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout API call failed:", e);
    }
    authService.clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },
};