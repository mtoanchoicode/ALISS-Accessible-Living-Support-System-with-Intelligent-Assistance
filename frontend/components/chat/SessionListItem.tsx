"use client";

import { motion } from "motion/react";
import { MessageSquare, ChevronRight, Trash2, Clock } from "lucide-react";
import { Session } from "@/types/chat";

interface SessionListItemProps {
  session: Session;
  onOpen: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export function SessionListItem({
  session,
  onOpen,
  onDelete,
}: SessionListItemProps) {
  return (
    <motion.div
      key={session.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(session.id)}
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group"
    >
      <div className="flex items-center space-x-4 min-w-0">
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 truncate">{session.title}</h4>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {session.lastMessage}
          </p>
          <div className="flex items-center space-x-2 mt-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {session.timestamp}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={(e) => onDelete(e, session.id)}
          className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <ChevronRight className="w-5 h-5 text-slate-300" />
      </div>
    </motion.div>
  );
}
