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
            ? "bg-[#3F62C7] text-white rounded-tr-sm shadow-md shadow-[#3F62C7]/10"
            : "bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm"
        }`}
      >
        <p className="text-sm leading-relaxed">{msg.text}</p>
        <div
          className={`flex items-center justify-between mt-2 ${
            isUser ? "text-[#dbeafe]" : "text-slate-400"
          }`}
        >
          <span className="text-[10px] font-medium">{msg.time}</span>
          {!isUser && (
            <button
              onClick={playAudio}
              disabled={!msg.audio_base64}
              className={`ml-2 hover:text-[#3F62C7] transition-colors ${
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
