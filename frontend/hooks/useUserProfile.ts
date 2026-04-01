import { useState, useEffect } from "react";
import { userService } from "@/services/userService";
import { UserProfile } from "@/types";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = localStorage.getItem("aliss_user_id");
        if (!userId) {
          setIsLoading(false);
          return;
        }
        const data = await userService.getUserProfile(userId);
        setProfile(data);
      } catch (error) {
        console.error("Failed to load user profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, isLoading };
}
