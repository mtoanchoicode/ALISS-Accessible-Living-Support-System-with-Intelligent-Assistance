'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Mic, Volume2, ImageIcon } from 'lucide-react';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  time: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I am your Memory Assistant. What are you looking for today?',
      sender: 'ai',
      time: '10:00 AM',
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `I checked the recent scans. Your keys were last seen on the Living Room coffee table about 10 minutes ago.`,
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative pb-16">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl p-3 ${
              msg.sender === 'user' 
                ? 'bg-teal-600 text-white rounded-tr-sm' 
                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
            }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div className={`flex items-center justify-between mt-1 ${
                msg.sender === 'user' ? 'text-teal-100' : 'text-slate-400'
              }`}>
                <span className="text-[10px]">{msg.time}</span>
                {msg.sender === 'ai' && (
                  <button className="ml-2 hover:text-teal-600 transition-colors">
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3">
        <form onSubmit={handleSend} className="flex items-end space-x-2">
          <button type="button" className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <ImageIcon className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-3 py-1.5 border border-transparent focus-within:border-teal-500 focus-within:bg-white transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to find something..."
              className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 text-slate-800 placeholder-slate-400 outline-none"
            />
            <button type="button" className="p-1.5 text-slate-400 hover:text-teal-600 transition-colors shrink-0">
              <Mic className="w-5 h-5" />
            </button>
          </div>
          <button 
            type="submit"
            disabled={!input.trim()}
            className={`p-3 rounded-full shrink-0 transition-colors ${
              input.trim() ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
