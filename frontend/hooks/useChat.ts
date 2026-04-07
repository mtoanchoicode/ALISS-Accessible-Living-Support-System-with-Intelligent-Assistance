import { useState, useRef, useEffect, useCallback } from "react";
import { chatService } from "@/services/chatService";

export type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
  time: string;
  audio_base64?: string;
  audio_mime?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
};

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const data = await chatService.getSessions();
      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        lastMessage: "Click to view conversation",
        timestamp: new Date(s.updated_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        messages: [],
      }));
      setSessions(mapped);
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!currentSessionId || currentSessionId === "new") {
        if (currentSessionId !== "new") setCurrentMessages([]);
        return;
      }
      try {
        const msgs = await chatService.getSessionMessages(currentSessionId);
        const mapped = (msgs || []).map((m: any) => ({
          id: m.id,
          text: m.text,
          sender: m.sender,
          time: new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setCurrentMessages(mapped);
      } catch (e) {
        console.error("Failed to load messages:", e);
      }
    };
    loadMessages();
  }, [currentSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (currentSessionId || currentMessages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [currentMessages, currentSessionId]);

  const createNewChat = () => {
    setCurrentSessionId("new");
    setCurrentMessages([
      {
        id: "greeting",
        text: "Hello! I am ALISS. How can I help you find something today?",
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  // --- NEW: Fully wired deleteSession ---
  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // Optimistic UI update: hide it immediately
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);

    try {
      await chatService.deleteSession(id);
    } catch (err) {
      console.error("Failed to delete session:", err);
      fetchSessions();
    }
  };

  // --- NEW: Refactored handleSend ---
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const userText = input;
    setInput("");

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: "user",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setCurrentMessages((prev) => [...prev, newUserMsg]);

    try {
      let activeSessionId = currentSessionId;

      if (!activeSessionId || activeSessionId === "new") {
        const newSession = await chatService.createSession();
        activeSessionId = newSession.session_id;
        setCurrentSessionId(activeSessionId);
      }

      const response = await chatService.chatV2(activeSessionId, userText);

      if (currentSessionId === "new") {
        fetchSessions();
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.answer,
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        audio_base64: response.audio_base64,
        audio_mime: response.audio_mime,
      };

      setCurrentMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error("Chat API Error:", err);
      setCurrentMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Sorry, I am having trouble connecting to my models.",
          sender: "ai",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return {
    sessions,
    isLoadingSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession: {
      title:
        currentSessionId === "new"
          ? "New Chat"
          : sessions.find((s) => s.id === currentSessionId)?.title,
      messages: currentMessages,
    },
    input,
    setInput,
    messagesEndRef,
    createNewChat,
    deleteSession,
    handleSend,
    isSending,
  };
}
