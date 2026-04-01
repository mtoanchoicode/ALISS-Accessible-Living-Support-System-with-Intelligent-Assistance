"use client";

import { motion } from "motion/react";
import {
  User,
  Settings,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function ProfilePage() {
  const { isChecking } = useAuth(); 
  const { isLoggingOut, handleLogout } = useProfile();
  const { profile, isLoading } = useUserProfile();

  const menuItems = [
    { icon: User, label: "Personal Information", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Settings, label: "App Settings", color: "text-slate-500", bg: "bg-slate-50" },
    { icon: Bell, label: "Notifications", color: "text-amber-500", bg: "bg-amber-50" },
    { icon: Shield, label: "Privacy & Security", color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  // Don't flash the UI while checking authentication
  if (isChecking) return null;

  return (
    <div className="p-4 space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4"
      >
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isLoading ? "Loading..." : profile ? `${profile.first_name} ${profile.last_name}` : "User"}
          </h2>
          <p className="text-sm text-slate-500">
            {isLoading ? "Loading..." : profile ? profile.email : ""}
          </p>
        </div>
      </motion.div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                index !== menuItems.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg} ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-slate-700">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </motion.button>
          );
        })}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full flex items-center justify-center space-x-2 p-4 bg-red-50 text-red-600 rounded-2xl font-medium hover:bg-red-100 transition-colors disabled:opacity-70"
      >
        {isLoggingOut ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <LogOut className="w-5 h-5" />
            <span>Log Out</span>
          </>
        )}
      </motion.button>
    </div>
  );
}