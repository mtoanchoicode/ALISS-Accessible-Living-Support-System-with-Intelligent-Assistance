import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import {
  validateEmail,
  validateVietnamesePhone,
  checkPasswordCriteria,
  formatPhoneForBackend,
} from "@/lib/validation";

export function useRegisterForm() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    phone: false,
    email: false,
    password: false,
  });

  const passwordCriteria = checkPasswordCriteria(formData.password);
  const isPhoneValid = validateVietnamesePhone(formData.phone);
  const isEmailValid = validateEmail(formData.email);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      password: true,
    });

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const fullPhone = formatPhoneForBackend(formData.phone);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 5000),
      );
      const response = (await Promise.race([
        authService.register({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: fullPhone,
          email: formData.email,
          password: formData.password,
        }),
        timeoutPromise,
      ])) as any;

      if (response.status === "success") {
        setSuccessMsg("Account created! Redirecting to login...");
      } else {
        setErrorMsg(
          response.message || "Registration failed. Please try again.",
        );
      }
    } catch (error: any) {
      if (error.message === "TIMEOUT") {
        setErrorMsg(
          "The server is taking too long to respond. Please try again.",
        );
      } else {
        setErrorMsg(error.message || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);

  return {
    showPassword,
    isLoading,
    errorMsg,
    successMsg,
    formData,
    touched,
    passwordCriteria,
    isPhoneValid,
    isEmailValid,
    handleChange,
    handleBlur,
    handleRegister,
    toggleShowPassword,
  };
}
