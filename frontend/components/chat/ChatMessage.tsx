"use client";

import { motion } from "motion/react";
import { Volume2, Loader2 } from "lucide-react";
import { Message } from "@/types/chat";
import { chatService } from "@/services/chatService";
import { useState } from "react";

interface MessageBubbleProps {
  msg: Message;
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const isUser = msg.sender === "user";
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  async function playAudio() {
    if (isPlaying || isLoadingAudio) return;
    
    try {
      setIsLoadingAudio(true);
      let audioSrc = "";
      
      if (msg.audio_base64 && msg.audio_mime) {
        audioSrc = `data:${msg.audio_mime};base64,${msg.audio_base64}`;
      } else {
        const blob = await chatService.speech(msg.text);
        audioSrc = URL.createObjectURL(blob);
      }
      
      const audio = new window.Audio(audioSrc);
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      
      await audio.play();
    } catch (e) {
      console.error("Audio playback failed", e);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
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
              disabled={isLoadingAudio}
              className={`ml-2 transition-colors ${
                isPlaying ? "text-primary animate-pulse" : "hover:text-primary"
              } ${isLoadingAudio ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Read aloud"
            >
              {isLoadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
