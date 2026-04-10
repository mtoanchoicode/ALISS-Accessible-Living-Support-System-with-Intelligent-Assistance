// frontend/services/authService.ts
import { apiClient } from "./apiClient";
import { loginAction, logoutAction } from "@/app/actions/auth";

export const authService = {
  login: async (email: string, password: string) => {
    // Call the unified Server Action that performs Supabase Authentication directly
    // and securely sets the HttpOnly cookie for the session.
    const result = await loginAction(email, password);
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  },

  register: async (userData: any) => {
    // We continue to hit the Next.js/FastAPI proxy for registration 
    // because it handles backend database insertion for user profiles.
    return apiClient("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },
  
  logout: async () => {
    // We call the Server Action to clear the HttpOnly Supabase cookies
    // instead of local storage manipulation.
    await logoutAction();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  logoutApi: async () => {
    return authService.logout();
  },
};