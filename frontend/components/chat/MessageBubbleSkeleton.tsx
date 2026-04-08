"use client";

export function MessageBubbleSkeleton() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl p-3.5 bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-medium text-slate-400">
            <span className="inline-block w-8 h-3 bg-slate-200 rounded animate-pulse" />
          </span>
        </div>
      </div>
    </div>
  );
}
