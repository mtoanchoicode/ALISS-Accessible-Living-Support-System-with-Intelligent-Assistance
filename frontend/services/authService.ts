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
  
  // Update 1: Save the token WITH a 1-day expiration timestamp
  saveToken: (token: string, userId?: string) => {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    localStorage.setItem("aliss_token", token);
    localStorage.setItem("aliss_token_expires", expiresAt.toString());
    if (userId) {
      localStorage.setItem("aliss_user_id", userId);
    }
    // Bind to Cookie strictly for Next.js Middleware tracking!
    document.cookie = `aliss_token=${token}; path=/; max-age=86400`;
  },
  
  // Update 2: Check expiration before returning the token
  getToken: () => {
    const token = localStorage.getItem("aliss_token");
    const expiresAt = localStorage.getItem("aliss_token_expires");

    if (!token || !expiresAt) return null;

    // Check if the current time is past the expiration time
    if (Date.now() > parseInt(expiresAt, 10)) {
      authService.logout(); // Clear expired data
      return null;
    }

    return token;
  },

  // Helper to clear everything on logout
  logout: () => {
    localStorage.removeItem("aliss_token");
    localStorage.removeItem("aliss_token_expires");
    localStorage.removeItem("aliss_user_id");
    // Purge middleware cookie tracker
    document.cookie = "aliss_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },

  logoutApi: async () => {
    return apiClient("/auth/logout", {
      method: "POST",
    });
  },
};