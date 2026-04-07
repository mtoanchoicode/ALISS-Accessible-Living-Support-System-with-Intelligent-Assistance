"use client";

import { MessageSquare } from "lucide-react";

interface EmptyStateProps {
  onStart: () => void;
}

export function EmptyState({ onStart }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
      <div className="space-y-1">
        <p className="text-slate-900 font-bold">No conversations yet</p>
        <p className="text-slate-500 text-sm">
          Start a new chat to find your items.
        </p>
      </div>
      <button
        onClick={onStart}
        className="bg-[#3F62C7] text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-[#3F62C7]/20 hover:bg-[#3F62C7] transition-all"
      >
        Start First Chat
      </button>
    </div>
  );
}
