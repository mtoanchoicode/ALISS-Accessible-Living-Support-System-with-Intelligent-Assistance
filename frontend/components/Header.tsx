"use client";

import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/" || pathname === "/register" || pathname === "/camera") {
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
          className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 hover:bg-teal-200 transition-colors"
        >
          <User className="w-6 h-6" />
        </button>
      )}
    </header>
  );
}
