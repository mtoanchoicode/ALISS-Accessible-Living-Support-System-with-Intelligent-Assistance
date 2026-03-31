import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";

interface UseAuthOptions {
  requireAuth?: boolean; 
  redirectTo?: string;  
}

export function useAuth({ requireAuth = true, redirectTo = "/" }: UseAuthOptions = {}) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = authService.getToken();
    // const hasToken = !!token;
    const hasToken = true;

    
    if (requireAuth && !hasToken) {
      // Trying to access a protected page without a token
      router.push(redirectTo);
    } else if (!requireAuth && hasToken) {
      // Trying to access Login/Register while already logged in
      router.push("/home");
    } else {
      // Passed the check
      setIsAuthenticated(hasToken);
      setIsChecking(false);
    }

    
  }, [router, requireAuth, redirectTo]);

  return { isChecking, isAuthenticated };
}