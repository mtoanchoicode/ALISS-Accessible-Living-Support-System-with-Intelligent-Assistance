import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { validateEmail } from "@/utils/validation";

export function useLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const executeLogin = async (email: string, password: string) => {
    // 1. Sanitization & Validation
    const cleanEmail = email.trim();

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    // 2. Execution
    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await authService.login(cleanEmail, password);
      
      if (response.access_token) {
        authService.saveToken(response.access_token, response.user_id);
        router.push("/storage"); 
      } else {
        setErrorMsg("Invalid email or password. Please try again.");
      }
    } catch (error: any) {
      setErrorMsg("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { executeLogin, isLoading, errorMsg };
}