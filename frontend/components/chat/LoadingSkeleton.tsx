"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-surface p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
              <Skeleton className="h-3 w-16 rounded mt-1.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
