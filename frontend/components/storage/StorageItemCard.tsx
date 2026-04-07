"use client";

import { motion } from "motion/react";
import { Video, Package, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
        {item.type === "item" ? (
          <img
            src={`http://127.0.0.1:8000${item.image_uri}`}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : item.type === "video" ? (
          <div className="bg-blue-50 w-full h-full flex items-center justify-center">
            {item.video_uri === "processing" ? (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            ) : (
              <Video className="w-6 h-6 text-blue-500" />
            )}
          </div>
        ) : (
          <Package className="w-6 h-6 text-slate-400" />
        )}
      </div>

      {/* Details Section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
          {/* Conditional "Seen By" Badge */}
          {item.seen_by && (
            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium uppercase">
              By {item.seen_by}
            </span>
          )}
        </div>

        {/* Location Row */}
        {item.location && (
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
            <MapPin className="w-3 h-3 text-[#3F62C7]" />
            <span className="text-[11px] font-medium truncate">
              {item.location.surface} <span className="text-slate-500">in</span>{" "}
              {item.location.room}
            </span>
          </div>
        )}

        {/* Attributes Row: Color, Material, Condition */}
        {(item.color || item.marterial || item.condition) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.color && (
              <span className="text-[10px] text-[#3F62C7] bg-blue-50 px-2 py-0.5 rounded-full">
                {item.color}
              </span>
            )}
            {item.marterial && (
              <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                {item.marterial}
              </span>
            )}
            {item.condition && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  item.condition.toLowerCase() === "good"
                    ? "text-green-600 bg-green-50"
                    : "text-orange-600 bg-orange-50"
                }`}
              >
                {item.condition}
              </span>
            )}
          </div>
        )}

        {/* Date Section */}
        <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase mt-2">
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
          className="p-2 text-slate-400 hover:text-[#3F62C7] bg-slate-50 hover:bg-[#eff6ff] rounded-full transition-colors shrink-0 outline-none"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Delete Button - Only show for items */}
        {item.type === "item" && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-full transition-colors shrink-0 outline-none"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
