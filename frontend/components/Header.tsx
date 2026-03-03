"use client";

import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const getTitle = () => {
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/chat":
        return "Memory Assistant";
      case "/record":
        return "Scanner & Monitor";
      case "/videos":
        return "Recorded Contexts";
      case "/profile":
        return "Settings";
      default:
        return "MemoryMap";
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 pt-safe">
      <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
        {getTitle()}
      </h1>
    </header>
  );
}
