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
    // Clear error when user starts typing again
    if (errorMsg) setErrorMsg("");
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

    // Client-side validation
    if (!formData.firstName || !formData.lastName) {
      setErrorMsg("First name and last name are required.");
      return;
    }
    if (!formData.email || !isEmailValid) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!formData.phone || !isPhoneValid) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }
    if (!passwordCriteria.isValid) {
      setErrorMsg("Password does not meet all requirements.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const fullPhone = formatPhoneForBackend(formData.phone);

      // Step 1: Register
      const response = await authService.register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: fullPhone,
        email: formData.email,
        password: formData.password,
      });

      if (response.status !== "success") {
        setErrorMsg(response.message || "Registration failed. Please try again.");
        return;
      }

      // Step 2: Auto-login after successful registration
      const loginResponse = await authService.login(formData.email, formData.password);

      if (loginResponse.access_token) {
        authService.saveToken(loginResponse.access_token, loginResponse.user_id);
        router.refresh();
        router.push("/");
      } else {
        // Registration succeeded but auto-login failed — redirect to login page
        setErrorMsg("Account created but auto-login failed. Please log in manually.");
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch (error: any) {
      // apiClient throws on non-2xx responses — extract the message
      const msg = error.message || "";
      if (msg.includes("API call failed")) {
        setErrorMsg("Email already in use or registration failed. Please try again.");
      } else if (msg === "TIMEOUT") {
        setErrorMsg("The server is taking too long to respond. Please try again.");
      } else {
        setErrorMsg(msg || "An unexpected error occurred.");
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
