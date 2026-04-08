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
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, isLoading, initials, isLoggingOut, handleLogout } =
    useUserProfile();

  const menuItems = [
    { icon: User, label: "Personal Information" },
    { icon: Settings, label: "App Settings" },
    { icon: Bell, label: "Notifications" },
    { icon: Shield, label: "Privacy & Security" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header (Keep interactive so user can go back while loading) */}
        <header className="px-4 py-4 flex items-center justify-between bg-surface border-b border-surface sticky top-0 z-10 shadow-sm">
          <button
            onClick={() => router.push("/home")}
            className="p-2 text-muted hover:text-body rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="p-2">
            <Link
              href="/edit"
              className="p-2 text-primary hover:text-azure rounded-full transition-colors"
            >
              <Edit3 className="w-6 h-6" />
            </Link>
          </div>
        </header>

        <div className="p-4 space-y-8 flex-grow">
          {/* Profile Header Skeleton */}
          <div className="flex flex-col items-center justify-center pt-4 pb-2">
            <Skeleton className="w-28 h-28 rounded-full shadow-sm" />
            <div className="mt-4 text-center space-y-2 flex flex-col items-center">
              <Skeleton className="w-48 h-8 rounded-md" />
              <Skeleton className="w-32 h-5 rounded-md mt-1" />
            </div>
          </div>

          {/* Menu Items Skeleton */}
          <div className="bg-surface overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
            {[1, 2, 3, 4].map((i, index) => (
              <div
                key={i}
                className={`w-full flex items-center justify-between p-5 ${
                  index !== 3 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-5 w-36 rounded" />
                </div>
                <Skeleton className="w-5 h-5 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="p-4 mt-auto border-t border-surface bg-background">
          <Skeleton className="w-full h-[56px] rounded-full" />
        </div>
      </div>
    );
  }

  // --- Actual Page Content ---
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-4 py-4 flex items-center justify-between bg-surface border-b border-surface sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => router.push("/home")}
          className="p-2 text-muted hover:text-body rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <Link
          href="/edit"
          className="p-2 text-primary hover:text-azure rounded-full transition-colors"
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
            <div className="w-28 h-28 bg-primary rounded-full flex items-center justify-center text-white shadow-md overflow-hidden relative">
              {profile?.image_uri ? (
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
                <User className="w-12 h-12 text-white/50" />
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-2xl font-extrabold text-body leading-tight">
              {profile ? `${profile.first_name} ${profile.last_name}` : "User"}
            </h2>
            <p className="text-muted font-medium mt-1">{profile?.email}</p>
          </div>
        </motion.div>

        <div className="bg-surface overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`w-full flex items-center justify-between p-5 hover:bg-slate-100 transition-colors ${
                  index !== menuItems.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-primary bg-background shadow-sm`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-body">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted" />
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="p-4 mt-auto border-t border-surface bg-background">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-surface text-body border-2 border-surface rounded-full font-bold hover:shadow-md transition-all duration-200 active:scale-95 disabled:opacity-70"
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="text-red-600">Sign Out</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
