import { useState } from "react";
import { validateEmail } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";

export function useLoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  const isEmailValid = validateEmail(email);

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!email || !isEmailValid || !password) {
      return; 
    }

    const cleanEmail = email.trim();

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 5000)
      );

      await Promise.race([
        authService.login(cleanEmail, password),
        timeoutPromise,
      ]);

      // The Server Action has set the HttpOnly session cookie.
      // Refresh the Next.js router cache so middleware detects the new session,
      // then navigate — this eliminates the race condition where router.push
      // runs before the cache knows about the authenticated state.
      router.refresh();
      router.push("/");
    } catch (error: any) {
      
      if (error.message === "TIMEOUT") {
        setErrorMsg("Request timed out. Please check your connection.");
      } else {
        setErrorMsg("Invalid email or password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword,
    touched,
    handleBlur,
    handleSubmit,
    isEmailValid,
    isLoading,
    errorMsg,
  };
}
