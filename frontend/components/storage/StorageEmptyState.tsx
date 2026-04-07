"use client";

import { Database } from "lucide-react";

interface StorageEmptyStateProps {
  message?: string;
}

export function StorageEmptyState({
  message = "No items found matching your search.",
}: StorageEmptyStateProps) {
  return (
    <div className="py-12 text-center space-y-3">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
        <Database className="w-8 h-8" />
      </div>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}
