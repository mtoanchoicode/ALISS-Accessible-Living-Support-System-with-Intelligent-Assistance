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
  ArrowLeft,
  Edit3,
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, isLoading, initials, isLoggingOut, handleLogout } = useUserProfile();

  const menuItems = [
    { icon: User, label: "Personal Information"},
    { icon: Settings, label: "App Settings"},
    { icon: Bell, label: "Notifications"},
    { icon: Shield, label: "Privacy & Security"},
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 z-10">
        <button 
          onClick={() => router.push("/home")}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <Link 
          href="/edit"
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-[#3F62C7]"
        >
          <Edit3 className="w-6 h-6" />
        </Link>
      </header>

      <div className="p-4 space-y-8 flex-grow">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center pt-4 pb-2"
        >
          <div className="relative group">
            <div className="w-28 h-28 bg-blueberry rounded-full flex items-center justify-center text-white shadow-md overflow-hidden relative">
              {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                ) : profile?.image_uri ? (
                  <Image
                    src={profile.image_uri}
                    alt="Profile"
                    fill
                    className="object-cover"
                    onLoadingComplete={(img) => img.classList.remove("opacity-0")}
                  />
                ) : initials ? (
                  <span className="text-3xl font-bold tracking-tighter text-white uppercase">
                    {initials}
                  </span>
                ) : (
                  <User className="w-12 h-12 text-creamy/50" />
                )}
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
              {isLoading ? (
                <span className="inline-block w-32 h-6 bg-slate-200 animate-pulse rounded" />
              ) : profile ? (
                `${profile.first_name} ${profile.last_name}`
              ) : (
                "User"
              )}
            </h2>
            <p className="text-slate-500 font-medium mt-1">
              {isLoading ? "Fetching details..." : profile?.email}
            </p>
          </div>
        </motion.div>

        <div className="bg-white overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${
                  index !== menuItems.length - 1 ? "border-b-1 border-slate-200" : ""
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-black`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-slate-700">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* --- BOTTOM LOGOUT SECTION --- */}
      <div className="p-4 mt-auto border-t border-slate-100 bg-white">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-[#3F62C7] text-white rounded-full font-bold hover:bg-red-100 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Sign Out</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}