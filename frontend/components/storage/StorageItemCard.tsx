import { motion } from "motion/react";
import { Video, Package, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
interface StorageItemCardProps {
  item: any;
  onEdit: (id: string, type: "item" | "video", name: string) => void;
  onDelete: (id: string) => void;
  activeTab: string;
}

export function StorageItemCard({
  item,
  onEdit,
  onDelete,
  activeTab,
}: StorageItemCardProps) {
  return (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, transition: { duration: 0.25 } }}
      className="bg-surface p-3 rounded-2xl border border-surface shadow-sm flex items-center space-x-4 active:scale-[0.98] transition-transform duration-200 relative overflow-hidden"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-background flex items-center justify-center shadow-sm">
        {item.type === "item" ? (
          <img
            src={`${BASE_URL}${item.image_uri}`}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : item.type === "video" ? (
          <div className="bg-primary/10 w-full h-full flex items-center justify-center">
            {item.video_uri === "processing" ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : (
              <Video className="w-6 h-6 text-primary" />
            )}
          </div>
        ) : (
          <Package className="w-6 h-6 text-muted" />
        )}
      </div>

      {/* Details Section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-body truncate">{item.name}</h4>
          {/* Conditional "Seen By" Badge */}
          {item.seen_by && (
            <span className="text-[9px] bg-background text-muted px-1.5 py-0.5 rounded-md font-medium uppercase border border-surface">
              By {item.seen_by}
            </span>
          )}
        </div>

        {/* Location Row */}
        {item.location && (
          <div className="flex items-center gap-1.5 mt-0.5 text-muted">
            <MapPin className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-medium truncate">
              {item.location.surface} <span className="text-muted/70">in</span>{" "}
              {item.location.room}
            </span>
          </div>
        )}

        {/* Attributes Row: Color, Material, Condition */}
        {(item.color || item.marterial || item.condition) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.color && (
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {item.color}
              </span>
            )}
            {item.marterial && (
              <span className="text-[10px] text-muted bg-background px-2 py-0.5 rounded-full">
                {item.marterial}
              </span>
            )}
            {item.condition && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  item.condition.toLowerCase() === "good"
                    ? "text-success bg-green-50"
                    : "text-warning bg-orange-50"
                }`}
              >
                {item.condition}
              </span>
            )}
          </div>
        )}

        {/* Date Section */}
        <div className="flex gap-2 text-[10px] text-muted font-bold uppercase mt-2">
          <span>
            {item.last_seen
              ? new Date(item.last_seen * 1000).toLocaleDateString()
              : "Date Unknown"}
          </span>
        </div>
      </div>

      {/* Action Buttons Group */}
      <div className="flex flex-col gap-2">
        {/* Edit Button */}
        <button
          onClick={() =>
            onEdit(
              item.id,
              item.type || (activeTab === "items" ? "item" : "video"),
              item.name,
            )
          }
          className="p-2 text-muted hover:text-primary bg-background hover:bg-surface hover:shadow-sm rounded-full transition-all duration-200 shrink-0 outline-none active:scale-95 border border-surface"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Delete Button - Only show for items */}
        {item.type === "item" && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 text-muted hover:text-red-500 bg-background hover:bg-red-500/10 hover:shadow-sm rounded-full transition-all duration-200 shrink-0 outline-none active:scale-95 border border-surface"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
