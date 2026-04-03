'use client';

import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Mic, 
  Volume2, 
  ImageIcon, 
  Plus, 
  MessageSquare, 
  ChevronRight, 
  ArrowLeft,
  Trash2,
  Clock
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';

export default function ChatPage() {
  const {
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
    isSending,
  } = useChat();

  if (!currentSessionId) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4 pb-24">
        {sessions.length !== 0 && ( 
          <div className="flex items-center justify-between px-1 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Recent Chats</h2>
            <button 
              onClick={createNewChat}
              className="flex items-center space-x-2 bg-[#3F62C7] text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-[#3F62C7]/20 hover:bg-[#3F62C7] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>
        )}
       

          {sessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 pb-12">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
              <MessageSquare className="w-10 h-10 text-slate-200" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-900 font-bold">No conversations yet</p>
              <p className="text-slate-500 text-sm">Start a new chat to find your items.</p>
            </div>
            <button 
              onClick={createNewChat}
              className="bg-[#3F62C7] text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-[#3F62C7]/20 hover:bg-[#3F62C7] transition-all"
            >
              Start First Chat
            </button>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setCurrentSessionId(session.id)}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-12 h-12 bg-[#eff6ff] rounded-2xl flex items-center justify-center text-[#3F62C7] shrink-0">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{session.title}</h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{session.lastMessage}</p>
                    <div className="flex items-center space-x-2 mt-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{session.timestamp}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Session Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center space-x-4">
        <button 
          onClick={() => setCurrentSessionId(null)}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 truncate text-sm">{currentSession?.title}</h3>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Active Session</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {currentSession?.messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl p-3.5 ${
              msg.sender === 'user' 
                ? 'bg-[#3F62C7] text-white rounded-tr-sm shadow-md shadow-[#3F62C7]/10' 
                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
            }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div className={`flex items-center justify-between mt-2 ${
                msg.sender === 'user' ? 'text-[#dbeafe]' : 'text-slate-400'
              }`}>
                <span className="text-[10px] font-medium">{msg.time}</span>
                {msg.sender === 'ai' && (
                  <button 
                    className={`ml-2 hover:text-[#3F62C7] transition-colors ${!msg.audio_base64 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                        if (msg.audio_base64 && msg.audio_mime) {
                            const audio = new window.Audio(`data:${msg.audio_mime};base64,${msg.audio_base64}`);
                            audio.play().catch(e => console.error("Audio playback failed", e));
                        }
                    }}
                  >
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
      <div className="fixed bottom-16 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-3 z-40">
        <form onSubmit={handleSend} className="flex items-end space-x-2 max-w-md mx-auto">
          <div className="flex-1 bg-slate-100 rounded-2xl flex items-center px-3 py-1.5 border border-transparent focus-within:border-[#3F62C7] focus-within:bg-white transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to find something..."
              className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 text-slate-800 placeholder-slate-400 outline-none"
            />
            <button type="button" className="p-1.5 text-slate-400 hover:text-[#3F62C7] transition-colors shrink-0">
              <Mic className="w-5 h-5" />
            </button>
          </div>
          <button 
            type="submit"
            disabled={!input.trim() || isSending}
            className={`p-3 rounded-full shrink-0 transition-colors ${
              input.trim() && !isSending ? 'bg-[#3F62C7] text-white shadow-lg shadow-[#3F62C7]/20 flex items-center justify-center' : 'bg-slate-100 text-slate-400 flex items-center justify-center'
            }`}
          >
            {isSending ? (
               <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
            ) : (
               <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
