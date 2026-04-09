import { useState, useRef, useEffect, useCallback } from "react";
import { chatService } from "@/services/chatService";
import { useRouter } from "next/navigation";

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

export function useChat(givenSessionId?: string | null) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(givenSessionId || null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [displayedText, setDisplayedText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (givenSessionId) {
      setCurrentSessionId(givenSessionId);
    }
  }, [givenSessionId]);

  useEffect(() => {
    const loadMessages = async () => {
      let hasOptimisticState = false;
      if (typeof window !== "undefined" && currentSessionId) {
        const optimisticStr = sessionStorage.getItem(`optimistic_${currentSessionId}`);
        if (optimisticStr) {
          setCurrentMessages(JSON.parse(optimisticStr));
          sessionStorage.removeItem(`optimistic_${currentSessionId}`);
          hasOptimisticState = true;
        }
      }

      if (!currentSessionId || currentSessionId === "new") {
        if (currentSessionId === "new" && !hasOptimisticState) setCurrentMessages([]);
        setIsLoadingMessages(false);
        return;
      }
      
      try {
        if (!hasOptimisticState) setIsLoadingMessages(true);
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
      } finally {
        setIsLoadingMessages(false);
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

  // Typing effect for streaming messages
  useEffect(() => {
    if (!streamingMessageId) {
      setDisplayedText("");
      return;
    }

    const messageBeingStreamed = currentMessages.find(
      (m) => m.id === streamingMessageId,
    );
    if (!messageBeingStreamed) return;

    const fullText = messageBeingStreamed.text;
    let charIndex = displayedText.length;

    if (charIndex >= fullText.length) {
      setStreamingMessageId(null);
      setDisplayedText("");
      return;
    }

    // Clear existing timer
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
    }

    // Reveal next character with 20ms delay
    streamTimerRef.current = setTimeout(() => {
      setDisplayedText((prev) => prev + fullText[charIndex]);
    }, 20);

    return () => {
      if (streamTimerRef.current) {
        clearTimeout(streamTimerRef.current);
      }
    };
  }, [streamingMessageId, displayedText, currentMessages]);

  const createNewChat = () => {
    router.push("/chat/new");
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
    
    // We capture the current state so we can serialize it during redirect
    let prevLocalState: Message[] = [];
    setCurrentMessages((prev) => {
      prevLocalState = [...prev, newUserMsg];
      return prevLocalState;
    });

    try {
      let activeSessionId = currentSessionId;

      if (!activeSessionId || activeSessionId === "new") {
        const newSession = await chatService.createSession();
        activeSessionId = newSession.session_id;
        setCurrentSessionId(activeSessionId);
      }

      const response = await chatService.chatV2(activeSessionId, userText);

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

      if (currentSessionId === "new") {
         if (typeof window !== "undefined") {
            sessionStorage.setItem(`optimistic_${activeSessionId}`, JSON.stringify([...prevLocalState, aiResponse]));
         }
        router.replace("/chat/" + activeSessionId);
        fetchSessions();
      } else {
         setCurrentMessages((prev) => [...prev, aiResponse]);
      }
      setStreamingMessageId(aiResponse.id);
      setDisplayedText("");
    } catch (err) {
      console.error("Chat API Error:", err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I am having trouble connecting to my models.",
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setCurrentMessages((prev) => [...prev, errorMsg]);
      setStreamingMessageId(errorMsg.id);
      setDisplayedText("");
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
      messages: currentMessages.map((msg) =>
        msg.id === streamingMessageId ? { ...msg, text: displayedText } : msg,
      ),
    },
    input,
    setInput,
    messagesEndRef,
    createNewChat,
    deleteSession,
    handleSend,
    isSending,
    isLoadingMessages,
    streamingMessageId,
  };
}
