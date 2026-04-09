"use client";

import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChatSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    currentSessionId,
    currentSession,
    input,
    setInput,
    messagesEndRef,
    handleSend,
    isSending,
    isLoadingMessages,
  } = useChat(id);

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Session Header */}
      <div className="bg-surface border-b border-surface px-4 py-3 flex items-center space-x-4 shadow-sm z-10 shrink-0">
        <button
          onClick={() => router.push("/chat")}
          className="p-2 -ml-2 text-muted hover:text-body transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h3 className="font-bold text-body truncate text-sm">
            {currentSession?.title || "Ask Anything"}
          </h3>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 relative">
        {isLoadingMessages ? (
          <div className="space-y-4 pt-2">
            <div className="flex justify-start">
              <div className="w-[65%] h-16 bg-surface rounded-2xl rounded-tl-sm animate-pulse" />
            </div>
            <div className="flex justify-end">
               <div className="w-[75%] h-20 bg-primary/20 rounded-2xl rounded-tr-sm animate-pulse" />
            </div>
            <div className="flex justify-start">
              <div className="w-[50%] h-12 bg-surface rounded-2xl rounded-tl-sm animate-pulse" />
            </div>
          </div>
        ) : currentSession?.messages.length === 0 && !isSending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-70 text-center space-y-4 pointer-events-none">
             <p className="text-body font-medium text-lg tracking-tight">Ask me anything...</p>
             <p className="text-muted text-sm max-w-[200px]">I can help you find objects or answer questions about your home.</p>
          </div>
        ) : null}

        {currentSession?.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        
        {isSending && (
          <div className="flex justify-start">
             <div className="max-w-[85%] rounded-2xl p-3.5 bg-surface border border-surface text-body rounded-tl-sm shadow-sm flex items-center space-x-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium animate-pulse text-muted tracking-wide">ALISS</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        input={input}
        isSending={isSending}
        onChange={setInput}
        onSubmit={handleSend}
      />
    </div>
  );
}
