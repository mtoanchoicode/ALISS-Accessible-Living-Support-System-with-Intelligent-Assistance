import { useEffect, useState } from "react";
import { authService } from "@/services/authService";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = authService.getToken();
    setIsAuthenticated(!!token);
    setIsChecking(false);
  }, []);

  return { isAuthenticated, isChecking };
}