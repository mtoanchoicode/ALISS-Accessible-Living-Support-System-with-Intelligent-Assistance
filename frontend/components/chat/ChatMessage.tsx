"use client";

import { motion } from "motion/react";
import { Volume2 } from "lucide-react";
import { Message } from "@/types/chat";

interface MessageBubbleProps {
  msg: Message;
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const isUser = msg.sender === "user";

  function playAudio() {
    if (!msg.audio_base64 || !msg.audio_mime) return;
    const audio = new window.Audio(
      `data:${msg.audio_mime};base64,${msg.audio_base64}`,
    );
    audio.play().catch((e) => console.error("Audio playback failed", e));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl p-3.5 ${
          isUser
            ? "bg-primary text-white rounded-tr-sm shadow-md shadow-primary/10"
            : "bg-surface border border-surface text-body rounded-tl-sm shadow-sm"
        }`}
      >
        <p className="text-sm leading-relaxed">{msg.text}</p>
        <div
          className={`flex items-center justify-between mt-2 ${
            isUser ? "text-white/80" : "text-muted"
          }`}
        >
          <span className="text-[10px] font-medium">{msg.time}</span>
          {!isUser && (
            <button
              onClick={playAudio}
              disabled={!msg.audio_base64}
              className={`ml-2 hover:text-primary transition-colors ${
                !msg.audio_base64 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
