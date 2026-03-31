"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Loader2,
  CheckCircle2,
  Circle
} from "lucide-react";
import { motion } from "motion/react";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { 
  validateEmail, 
  validateVietnamesePhone, 
  checkPasswordCriteria, 
  formatPhoneForBackend 
} from "@/utils/validation";

export default function Register() {
  const router = useRouter();
  const { isChecking } = useAuth({ requireAuth: false });

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

  // Validation trackers
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
      firstName: true, lastName: true, phone: true, email: true, password: true
    });

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const fullPhone = formatPhoneForBackend(formData.phone);

      const response = await authService.register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: fullPhone, 
        email: formData.email,
        password: formData.password,
      });

      if (response.data.status === "error") {
        setErrorMsg(response.data.message || "Registration failed. Please try again.");
      } else {
        setSuccessMsg("Account created! Redirecting to login...");
        setTimeout(() => router.push("/"), 2000);
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) return null;

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm mx-auto"
      >
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Create Account
          </h2>
          <p className="mt-2 text-slate-500">Join ALISS</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-teal-50 text-teal-700 text-sm rounded-xl border border-teal-100 text-center">
              {successMsg}
            </div>
          )}

          {/* First Name & Last Name */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 bg-slate-50 text-slate-900 placeholder-slate-400 transition-colors ${
                    touched.firstName && !formData.firstName ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-teal-500 focus:border-teal-500"
                  }`}
                  placeholder="Jane"
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 bg-slate-50 text-slate-900 placeholder-slate-400 transition-colors ${
                  touched.lastName && !formData.lastName ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-teal-500 focus:border-teal-500"
                }`}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
            <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
              <div className="flex items-center justify-center bg-slate-100 px-3 border-r border-slate-200 text-slate-600 select-none">
                <span className="text-lg mr-1"><span className="fi fi-vn"></span></span>
                <span className="text-sm font-medium">+84</span>
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                className="block w-full pl-3 pr-3 py-3 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none"
                placeholder="912 345 678"
              />
            </div>
            {touched.phone && formData.phone && !isPhoneValid && (
              <p className="text-red-500 text-xs mt-1">Enter a valid phone number</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 bg-slate-50 text-slate-900 placeholder-slate-400 transition-colors ${
                  touched.email && (!formData.email || !isEmailValid) ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-teal-500 focus:border-teal-500"
                }`}
                placeholder="you@example.com"
              />
            </div>
            {touched.email && formData.email && !isEmailValid && (
              <p className="text-red-500 text-xs mt-1">Enter a valid email address</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 bg-slate-50 text-slate-900 placeholder-slate-400 transition-colors ${
                  touched.password && !passwordCriteria.isValid ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-teal-500 focus:border-teal-500"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                ) : (
                  <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                )}
              </button>
            </div>
            {touched.password && !formData.password && (
              <p className="text-red-500 text-xs mt-1 mb-2">Required</p>
            )}

            {/* Password Tracker UI */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div className={`flex items-center gap-1.5 ${passwordCriteria.length ? "text-teal-600" : ""}`}>
                {passwordCriteria.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                <span>8+ characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordCriteria.uppercase ? "text-teal-600" : ""}`}>
                {passwordCriteria.uppercase ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                <span>At least one uppercase</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordCriteria.number ? "text-teal-600" : ""}`}>
                {passwordCriteria.number ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                <span>At least one number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordCriteria.special ? "text-teal-600" : ""}`}>
                {passwordCriteria.special ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                <span>At least one special char</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || successMsg !== ""}
            className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:opacity-70 mt-4"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/"
            className="font-semibold text-teal-600 hover:text-teal-500"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}