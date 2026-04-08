import { Skeleton } from "./ui/Skeleton";

export default function StorageSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-surface p-3 rounded-2xl border border-slate-100 flex items-center space-x-4"
        >
          {/* Image Placeholder */}
          <Skeleton className="w-16 h-16 rounded-xl shrink-0" />

          <div className="flex-1 space-y-3">
            {/* Title Placeholder */}
            <Skeleton className="h-4 rounded-md w-1/3" />

            <div className="flex space-x-3">
              {/* Metadata Placeholders */}
              <Skeleton className="h-3 rounded-md w-20" />
              <Skeleton className="h-3 rounded-md w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
