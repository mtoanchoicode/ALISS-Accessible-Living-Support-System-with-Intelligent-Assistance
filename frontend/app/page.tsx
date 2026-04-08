"use client";

import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useLoginForm } from "@/hooks/useLoginForm";

export default function Login() {
  const {
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
  } = useLoginForm();

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-body tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-muted">Sign in to ALISS</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-sm mx-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center">
              {errorMsg}
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
                className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 bg-surface text-body placeholder-muted transition-colors ${
                  touched.email && (!email || !isEmailValid) ? "border-red-500 focus:ring-red-500" : "border-slate-100 focus:ring-primary focus:border-primary"
                }`}
                placeholder="you@example.com"
              />
            </div>
            {/* Inline validation feedback */}
            {touched.email && !email && (
              <p className="text-red-500 text-xs mt-1">Email is required</p>
            )}
            {touched.email && email && !isEmailValid && (
              <p className="text-red-500 text-xs mt-1">Enter a valid email address</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 bg-surface text-body placeholder-muted transition-colors ${
                  touched.password && !password ? "border-red-500 focus:ring-red-500" : "border-slate-100 focus:ring-primary focus:border-primary"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={toggleShowPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-muted hover:text-body" />
                ) : (
                  <Eye className="h-5 w-5 text-muted hover:text-body" />
                )}
              </button>
            </div>
            {/* Inline validation feedback */}
            {touched.password && !password && (
              <p className="text-red-500 text-xs mt-1">Password is required</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary active:scale-95 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary hover:text-azure transition-colors"
          >
            Create one now
          </Link>
        </p>
      </motion.div>
    </div>
  );
}