"use client";

import { Send, Mic, MicOff } from "lucide-react";
import "regenerator-runtime/runtime";
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useEffect } from "react";

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
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    if (listening && transcript) {
      onChange(transcript);
    }
  }, [transcript, listening, onChange]);

  const toggleListening = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser doesn't support speech recognition.");
      return;
    }
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-surface p-3 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
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
            onClick={toggleListening}
            title="Voice input"
            className={`p-1.5 transition-colors shrink-0 ${listening ? "text-primary animate-pulse" : "text-muted hover:text-primary"}`}
          >
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
