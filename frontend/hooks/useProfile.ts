import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";

export function useProfile() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logoutApi(); 
      authService.logout(); 
      router.push("/"); 
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    isLoggingOut,
    handleLogout,
  };
}
