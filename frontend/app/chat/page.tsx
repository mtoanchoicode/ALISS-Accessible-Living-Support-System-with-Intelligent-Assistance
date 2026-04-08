"use client";

import { Plus, ArrowLeft } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { LoadingSkeleton } from "@/components/chat/LoadingSkeleton";
import { EmptyState } from "@/components/chat/EmptyState";
import { SessionListItem } from "@/components/chat/SessionListItem";
import { MessageBubble } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";

export default function ChatPage() {
  const {
    sessions,
    isLoadingSessions,
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

  // 1. MAIN MENU VIEW
  if (!currentSessionId) {
    const showHeader = sessions.length !== 0 || isLoadingSessions;

    return (
      <div className="flex flex-col h-full bg-background p-4 pb-24">
        {showHeader && (
          <div className="flex items-center justify-between px-1 mb-6">
            <h2 className="text-xl font-bold text-body">Recent Chats</h2>
            <button
              onClick={createNewChat}
              disabled={isLoadingSessions}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md ${
                isLoadingSessions
                  ? "bg-surface text-muted cursor-not-allowed shadow-none"
                  : "bg-primary text-white shadow-primary/20"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>
        )}

        {isLoadingSessions ? (
          <LoadingSkeleton />
        ) : sessions.length === 0 ? (
          <EmptyState onStart={createNewChat} />
        ) : (
          <div className="space-y-3 overflow-y-auto">
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                onOpen={setCurrentSessionId}
                onDelete={deleteSession}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Session Header */}
      <div className="bg-surface border-b border-surface px-4 py-3 flex items-center space-x-4 shadow-sm">
        <button
          onClick={() => setCurrentSessionId(null)}
          className="p-2 -ml-2 text-muted hover:text-body transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h3 className="font-bold text-body truncate text-sm">
            {currentSession?.title}
          </h3>
          <p className="text-[10px] text-success font-bold uppercase tracking-widest">
            Active Session
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {currentSession?.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
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
