export default function StorageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center space-x-4"
        >
          {/* Image Placeholder */}
          <div className="w-16 h-16 rounded-xl bg-slate-200 shrink-0" />

          <div className="flex-1 space-y-3">
            {/* Title Placeholder */}
            <div className="h-4 bg-slate-200 rounded-md w-1/3" />

            <div className="flex space-x-3">
              {/* Metadata Placeholders */}
              <div className="h-3 bg-slate-100 rounded-md w-20" />
              <div className="h-3 bg-slate-100 rounded-md w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
