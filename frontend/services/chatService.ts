// frontend/services/chatService.ts
import { apiClient } from "./apiClient";

export const chatService = {
  getSessions: async () => {
    return apiClient(`/chats`, { method: "GET" });
  },

  getSessionMessages: async (sessionId: string) => {
    return apiClient(`/chats/${sessionId}/messages`, { method: "GET" });
  },

  chat: async (sessionId: string | null, message: string, k: number = 5, withTts: boolean = false, ttsVoice?: string) => {
    return apiClient("/chat", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        message,
        k,
        with_tts: withTts,
        tts_voice: ttsVoice
      }),
    });
  },

  speech: async (text: string, voice?: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://172.16.1.236:8000";
    const response = await fetch(`${BASE_URL}/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voice }),
    });
    
    if (!response.ok) {
        throw new Error("Failed to generate speech audio");
    }
    // Return the Mp3 bytes blob
    return response.blob(); 
  }
};
