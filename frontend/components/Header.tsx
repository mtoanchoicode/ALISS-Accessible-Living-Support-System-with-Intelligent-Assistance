"use client";

import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  const { profile, initials, isLoading } = useUserProfile();

  if (
    pathname === "/" ||
    pathname === "/register" ||
    pathname === "/camera" ||
    pathname === "/profile" ||
    pathname === "/edit"
  ) {
    return null;
  }

  const getTitle = () => {
    switch (pathname) {
      case "/home":
        return "Home";
      case "/chat":
        return "Memory Assistant";
      case "/camera":
        return "Camera";
      case "/live":
        return "Home Monitor";
      case "/storage":
        return "Storage";
      case "/profile":
        return "Settings";
      default:
        return "ALISS";
    }
  };

  return (
    <header className="shrink-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
        {getTitle()}
      </h1>
      
      {pathname === "/home" && (
        <button
          onClick={() => router.push("/profile")}
          className="w-10 h-10 bg-[#dbeafe] rounded-full flex items-center justify-center text-[#3F62C7] hover:bg-[#bfdbfe] transition-colors overflow-hidden border border-blue-200 shadow-sm"
        >
          {/* 2. The Fallback Avatar Logic */}
          {isLoading ? (
            <div className="w-full h-full animate-pulse bg-blue-200" />
          ) : profile?.image_uri ? (
            <img 
              src={profile.image_uri} 
              alt={`${profile.first_name}'s avatar`} 
              className="w-full h-full object-cover"
            />
          ) : initials ? (
            <span className="font-bold text-sm">{initials}</span>
          ) : (
            <User className="w-5 h-5" />
          )}
        </button>
      )}
    </header>
  );
}