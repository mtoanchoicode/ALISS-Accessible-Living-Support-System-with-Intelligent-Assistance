"use client";

import { Send, Mic } from "lucide-react";

interface ChatInputProps {
  input: string;
  isSending: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChatInput({
  input,
  isSending,
  onChange,
  onSubmit,
}: ChatInputProps) {
  return (
    <div className="fixed bottom-16 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-3 z-40">
      <form
        onSubmit={onSubmit}
        className="flex items-end space-x-2 max-w-md mx-auto"
      >
        <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-3 py-1.5 border border-transparent focus-within:border-[#3F62C7] focus-within:bg-white transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask me to find something..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 text-slate-800 placeholder-slate-400 outline-none"
          />
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-[#3F62C7] transition-colors shrink-0"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className={`p-3 rounded-full shrink-0 transition-colors flex items-center justify-center ${
            input.trim() && !isSending
              ? "bg-[#3F62C7] text-white shadow-lg shadow-[#3F62C7]/20"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
