import { useState, useRef, useEffect, useCallback } from 'react';
import { chatService } from '@/services/chatService';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
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
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await chatService.getSessions();
      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        lastMessage: "Click to view conversation", 
        timestamp: new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: []
      }));
      setSessions(mapped);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!currentSessionId) {
        setCurrentMessages([]);
        return;
      }
      if (currentSessionId === 'new') {
        return;
      }
      try {
        const msgs = await chatService.getSessionMessages(currentSessionId);
        const mapped = (msgs || []).map((m: any) => ({
          id: m.id,
          text: m.text,
          sender: m.sender,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setCurrentMessages(mapped);
      } catch (e) {
        console.error(e);
      }
    };
    loadMessages();
  }, [currentSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentSessionId || currentMessages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [currentMessages, currentSessionId]);

  const createNewChat = () => {
    setCurrentSessionId('new');
    setCurrentMessages([{
      id: 'greeting',
      text: 'Hello! I am ALISS. How can I help you find something today?',
      sender: 'ai',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // In later iterations, bind this to `DELETE /chats/{id}`
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const userText = input;
    setInput('');

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setCurrentMessages(prev => [...prev, newUserMsg]);

    try {
      const passedSessionId = currentSessionId === 'new' ? null : currentSessionId;
      const response = await chatService.chat(passedSessionId, userText, 5, true); 

      if ((!currentSessionId || currentSessionId === 'new') && response.session_id) {
         setCurrentSessionId(response.session_id);
         fetchSessions(); // Background pull sidebars 
      }
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.answer,
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audio_base64: response.audio_base64,
        audio_mime: response.audio_mime
      };

      setCurrentMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      console.error(err);
      setCurrentMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I am having trouble connecting to my models.",
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession: { 
      title: currentSessionId === 'new' ? 'New Chat' : sessions.find(s => s.id === currentSessionId)?.title, 
      messages: currentMessages 
    },
    input,
    setInput,
    messagesEndRef,
    createNewChat,
    deleteSession,
    handleSend,
    isSending
  };
}
