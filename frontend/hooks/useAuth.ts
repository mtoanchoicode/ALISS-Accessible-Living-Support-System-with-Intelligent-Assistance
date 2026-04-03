import { useEffect, useState } from "react";
import { authService } from "@/services/authService";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = authService.getToken();
    setIsAuthenticated(!!token);
  }, []);

  return { isAuthenticated };
}