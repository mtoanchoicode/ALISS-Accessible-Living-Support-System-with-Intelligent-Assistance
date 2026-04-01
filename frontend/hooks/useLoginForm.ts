import { useState } from "react";
import { useLogin } from "@/hooks/useLogin";
import { validateEmail } from "@/utils/validation";

export function useLoginForm() {
  const { executeLogin, isLoading, errorMsg } = useLogin();
  
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!email || !isEmailValid || !password) {
      return; 
    }

    executeLogin(email, password);
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
