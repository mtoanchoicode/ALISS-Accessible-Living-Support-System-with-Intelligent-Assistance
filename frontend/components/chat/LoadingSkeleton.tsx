"use client";

export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <div className="w-12 h-12 bg-slate-200 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-16 bg-slate-200 rounded mt-1.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
