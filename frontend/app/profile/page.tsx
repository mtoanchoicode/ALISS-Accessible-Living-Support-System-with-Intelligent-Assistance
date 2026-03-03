"use client";

import { motion } from "motion/react";
import {
  User,
  Settings,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = () => {
    router.push("/login");
  };

  const menuItems = [
    {
      icon: User,
      label: "Personal Information",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      icon: Settings,
      label: "App Settings",
      color: "text-slate-500",
      bg: "bg-slate-50",
    },
    {
      icon: Bell,
      label: "Notifications",
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      icon: Shield,
      label: "Privacy & Security",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4"
      >
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Jane Doe</h2>
          <p className="text-sm text-slate-500">jane.doe@example.com</p>
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
                index !== menuItems.length - 1
                  ? "border-b border-slate-100"
                  : ""
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg} ${item.color}`}
                >
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
        className="w-full flex items-center justify-center space-x-2 p-4 bg-red-50 text-red-600 rounded-2xl font-medium hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Log Out</span>
      </motion.button>
    </div>
  );
}
