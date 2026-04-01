import { useState, useRef, useEffect } from 'react';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  time: string;
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
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem('memory_map_chats');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setTimeout(() => setSessions(parsed), 0);
      } catch (e) {
        console.error('Error loading chats', e);
      }
    }
  }, []);

  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem('memory_map_chats', JSON.stringify(updatedSessions));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentSessionId) {
      scrollToBottom();
    }
  }, [currentSessionId, sessions]);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      lastMessage: 'Started just now',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: '1',
          text: 'Hello! I am your Memory Assistant. How can I help you find something today?',
          sender: 'ai',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !currentSessionId) return;

    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      time,
    };

    const updatedMessages = [...session.messages, newUserMsg];
    const updatedSession = {
      ...session,
      messages: updatedMessages,
      lastMessage: input,
      title: session.messages.length === 1 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : session.title
    };

    const updatedSessions = sessions.map(s => s.id === currentSessionId ? updatedSession : s);
    saveSessions(updatedSessions);
    setInput('');

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `I've analyzed your recent scans. Based on your history, that item was last seen in the Living Room near the shelf.`,
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      const sessionWithAi = {
        ...updatedSession,
        messages: [...updatedMessages, aiResponse],
        lastMessage: aiResponse.text
      };
      
      const finalSessions = sessions.map(s => s.id === currentSessionId ? sessionWithAi : s);
      saveSessions(finalSessions);
    }, 1500);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    input,
    setInput,
    messagesEndRef,
    createNewChat,
    deleteSession,
    handleSend,
  };
}
