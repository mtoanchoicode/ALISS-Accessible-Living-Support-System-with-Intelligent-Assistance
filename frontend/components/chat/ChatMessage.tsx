"use client";

import { motion } from "motion/react";
import { Volume2, Loader2 } from "lucide-react";
import { Message } from "@/types/chat";
import { chatService } from "@/services/chatService";
import { useState, useEffect } from "react";

// Global references to manage a singleton audio instance and prevent multiplexing/memory bloat
let globalAudio: HTMLAudioElement | null = null;
let globalPlaybackCleanup: (() => void) | null = null;

interface MessageBubbleProps {
  msg: Message;
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const isUser = msg.sender === "user";
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Cleanup on unmount if this component is playing audio
  useEffect(() => {
    return () => {
      if (isPlaying && globalPlaybackCleanup) {
        if (globalAudio) {
          globalAudio.pause();
          globalAudio.removeAttribute("src");
          globalAudio.load();
          globalAudio = null;
        }
        globalPlaybackCleanup();
        globalPlaybackCleanup = null;
      }
    };
  }, [isPlaying]);

  async function playAudio() {
    // If this specific message is already playing, toggle it off
    if (isPlaying) {
      if (globalAudio) {
        globalAudio.pause();
        globalAudio.removeAttribute("src");
        globalAudio.load();
      }
      if (globalPlaybackCleanup) {
        globalPlaybackCleanup();
        globalPlaybackCleanup = null;
      }
      globalAudio = null;
      return;
    }

    if (isLoadingAudio) return;
    
    try {
      setIsLoadingAudio(true);
      
      // Stop any globally playing audio to prevent overlapping voices
      if (globalAudio) {
        globalAudio.pause();
        globalAudio.removeAttribute("src");
        globalAudio.load();
      }
      if (globalPlaybackCleanup) {
        globalPlaybackCleanup();
      }

      let audioSrc = "";
      let isBlob = false;
      
      if (msg.audio_base64 && msg.audio_mime) {
        audioSrc = `data:${msg.audio_mime};base64,${msg.audio_base64}`;
      } else {
        const blob = await chatService.speech(msg.text);
        audioSrc = URL.createObjectURL(blob);
        isBlob = true;
      }
      
      const audio = new window.Audio(audioSrc);
      globalAudio = audio;
      
      const cleanup = () => {
        setIsPlaying(false);
        if (isBlob) {
          URL.revokeObjectURL(audioSrc); // Critical for memory garbage collection
        }
      };
      
      globalPlaybackCleanup = cleanup;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        cleanup();
        if (globalAudio === audio) {
          globalAudio = null;
          globalPlaybackCleanup = null;
        }
      };
      audio.onerror = () => {
        cleanup();
        if (globalAudio === audio) {
          globalAudio = null;
          globalPlaybackCleanup = null;
        }
      };
      
      await audio.play();
    } catch (e) {
      console.error("Audio playback failed", e);
      setIsPlaying(false);
      // Only nullify if the failure was for the current global instance
      if (globalAudio) {
        globalAudio = null;
      }
      if (globalPlaybackCleanup) {
        globalPlaybackCleanup = null;
      }
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
              title={isPlaying ? "Stop audio" : "Read aloud"}
            >
              {isLoadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
