"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Camera, Video, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Record", href: "/record", icon: Camera, isMain: true },
    { name: "Videos", href: "/videos", icon: Video },
    { name: "Profile", href: "/profile", icon: User },
  ];

  // Don't show nav on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 pb-safe z-50">
      <div className="flex justify-around items-center h-16 relative px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isMain) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative -top-5 flex flex-col items-center justify-center w-14 h-14 bg-teal-600 rounded-full shadow-lg shadow-teal-600/30 text-white hover:bg-teal-700 transition-colors border-4 border-white"
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
                  ? "text-teal-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon
                className={`w-6 h-6 ${isActive ? "fill-teal-50 stroke-teal-600" : ""}`}
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
