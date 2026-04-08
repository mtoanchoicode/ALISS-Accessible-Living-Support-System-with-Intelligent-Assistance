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
    <div className="fixed bottom-16 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-surface p-3 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
      <form
        onSubmit={onSubmit}
        className="flex items-end space-x-2 max-w-md mx-auto"
      >
        <div className="flex-1 bg-surface rounded-2xl flex items-center px-3 py-1.5 border border-transparent focus-within:border-primary focus-within:bg-background transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask me to find something..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 text-body placeholder-muted outline-none"
          />
          <button
            type="button"
            className="p-1.5 text-muted hover:text-primary transition-colors shrink-0"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          className={`p-3 rounded-full shrink-0 transition-all duration-200 flex items-center justify-center ${
            input.trim()
              ? "bg-primary text-white shadow-md shadow-primary/20 active:scale-95"
              : "bg-surface text-muted"
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
