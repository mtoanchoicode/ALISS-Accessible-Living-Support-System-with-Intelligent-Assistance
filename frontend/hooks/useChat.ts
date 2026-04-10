import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

// Shared query keys — ensures all consumers of chat data hit the same cache slot.
export const CHAT_SESSIONS_KEY = ["chatSessions"] as const;
export const chatMessagesKey = (sessionId: string) => ["chatMessages", sessionId] as const;

function mapSession(s: any): ChatSession {
  return {
    id: s.id,
    title: s.title,
    lastMessage: "Click to view conversation",
    timestamp: new Date(s.updated_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    messages: [],
  };
}

function mapMessage(m: any): Message {
  return {
    id: m.id,
    text: m.text,
    sender: m.sender,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function useChat(givenSessionId?: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(givenSessionId || null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track whether we consumed optimistic state from sessionStorage.
  // While true, we skip the useQuery fetch entirely to prevent:
  //   1. Skeleton flashing over messages we already have
  //   2. A stale/empty server response overwriting our optimistic messages
  const [hasOptimisticMessages, setHasOptimisticMessages] = useState(() => {
    if (typeof window === "undefined" || !givenSessionId) return false;
    return !!sessionStorage.getItem(`optimistic_${givenSessionId}`);
  });

  // ─── Sessions: useQuery (deduplicated, cached, synced) ───
  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
  } = useQuery<ChatSession[]>({
    queryKey: CHAT_SESSIONS_KEY,
    queryFn: async () => {
      const data = await chatService.getSessions();
      return (data || []).map(mapSession);
    },
  });

  // ─── Messages: useQuery (keyed per session, cached) ───
  // Disabled when we have optimistic messages — no skeleton, no stale overwrites.
  const {
    data: fetchedMessages,
    isLoading: isQueryLoadingMessages,
  } = useQuery<Message[]>({
    queryKey: chatMessagesKey(currentSessionId || ""),
    queryFn: async () => {
      const msgs = await chatService.getSessionMessages(currentSessionId!);
      return (msgs || []).map(mapMessage);
    },
    enabled: !!currentSessionId && currentSessionId !== "new" && !hasOptimisticMessages,
  });

  // Consume optimistic state from sessionStorage on mount.
  // This runs once before the query is enabled, locking in the optimistic messages.
  useEffect(() => {
    if (typeof window === "undefined" || !currentSessionId) return;

    const optimisticStr = sessionStorage.getItem(`optimistic_${currentSessionId}`);
    if (optimisticStr) {
      setCurrentMessages(JSON.parse(optimisticStr));
      sessionStorage.removeItem(`optimistic_${currentSessionId}`);
      setHasOptimisticMessages(true);
      return;
    }

    if (currentSessionId === "new") {
      setCurrentMessages([]);
    }
  }, [currentSessionId]);

  // Sync from useQuery ONLY when there's no optimistic override active
  useEffect(() => {
    if (hasOptimisticMessages) return; // Never overwrite optimistic state
    if (fetchedMessages) {
      setCurrentMessages(fetchedMessages);
    }
  }, [fetchedMessages, hasOptimisticMessages]);

  // The isLoadingMessages exposed to consumers should be false when we have
  // optimistic messages (no skeleton!) or when we already have local messages.
  const isLoadingMessages = isQueryLoadingMessages && !hasOptimisticMessages && currentMessages.length === 0;

  useEffect(() => {
    if (givenSessionId) {
      setCurrentSessionId(givenSessionId);
    }
  }, [givenSessionId]);

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

  // ─── Delete Session: useMutation with optimistic cache update ───
  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => chatService.deleteSession(id),
    onMutate: async (id: string) => {
      // Cancel any in-flight queries for sessions
      await queryClient.cancelQueries({ queryKey: CHAT_SESSIONS_KEY });

      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData<ChatSession[]>(CHAT_SESSIONS_KEY);

      // Optimistic update: remove from cache immediately
      queryClient.setQueryData<ChatSession[]>(CHAT_SESSIONS_KEY, (old) =>
        (old || []).filter((s) => s.id !== id)
      );

      if (currentSessionId === id) setCurrentSessionId(null);

      return { previousSessions };
    },
    onError: (_err, _id, context) => {
      // Rollback on failure
      if (context?.previousSessions) {
        queryClient.setQueryData(CHAT_SESSIONS_KEY, context.previousSessions);
      }
    },
  });

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSessionMutation.mutate(id);
  };

  // ─── Handle Send ───
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
        // Invalidate sessions so the sidebar picks up the new session
        queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_KEY });
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
