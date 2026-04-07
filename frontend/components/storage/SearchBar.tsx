"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search items or locations...",
}: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3F62C7]/20 focus:border-[#3F62C7] transition-all"
      />
    </div>
  );
}
