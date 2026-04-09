"use client";

import { Plus } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { LoadingSkeleton } from "@/components/chat/LoadingSkeleton";
import { EmptyState } from "@/components/chat/EmptyState";
import { SessionListItem } from "@/components/chat/SessionListItem";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const router = useRouter();
  const {
    sessions,
    isLoadingSessions,
    createNewChat,
    deleteSession,
  } = useChat();

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
        <div className="h-full space-y-3 overflow-y-auto">
          {sessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              onOpen={(id) => router.push(`/chat/${id}`)}
              onDelete={deleteSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}
