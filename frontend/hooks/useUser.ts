import { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types/index"; 
import { userService } from "@/services/userService";

export function useUserData(isChecking: boolean) {
  // 1. We expect a single user object, not an array of items
  const [user, setUser] = useState<UserProfile[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const backendUser = await userService.getUser();

      setUser(backendUser);
      
    } catch (err: any) {
      console.error("Failed to fetch user data:", err);
      setError("Failed to load user profile.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isChecking) return;
    fetchUserData();
  }, [isChecking, fetchUserData]);

  return { user, isLoading, error, refetch: fetchUserData };
}