"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Camera, Database, Video } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/home", icon: Home },
    { name: "Live", href: "/live", icon: Video },
    { name: "Camera", href: "/camera", icon: Camera, isMain: true },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Storage", href: "/storage", icon: Database },
  ];

  // Don't show nav on auth pages
  if (pathname === "/" || pathname === "/register" || pathname === "/camera" || pathname === "/profile"|| pathname === "/edit") {
    return null;
  }

  return (
    <nav className="w-full shrink-0 mt-auto bg-white border-t border-slate-200 pb-safe z-50">
      <div className="flex justify-around items-center h-16 relative px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isMain) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative -top-5 flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors border-4 border-white ${
                  isActive 
                    ? "bg-[#3F62C7] shadow-[#3F62C7]/40" 
                    : "bg-[#3F62C7] shadow-[#3F62C7]/30 hover:bg-[#3F62C7]"
                } text-white`}
              >
                <Icon className="w-6 h-6" strokeWidth={2.5} />
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${
                isActive
                  ? "text-[#3F62C7]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon
                className={`w-6 h-6 ${isActive ? "fill-[#eff6ff] stroke-[#3F62C7]" : ""}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
