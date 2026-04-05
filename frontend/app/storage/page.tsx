"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Database,
  Search,
  Video,
  Package,
  Pencil,
  Plus,
  Loader2,
  MapPin,
  Trash2,
} from "lucide-react";
import StorageSkeleton from "@/components/StorageSkeleton";
import { useStorage } from "@/hooks/useStorage";
import { EditItemModal } from "./components/EditItemModal";
import { UploadVideoModal } from "./components/UploadVideoModal";

export default function StoragePage() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredItems,
    isLoading,
    refetch,
    // Actions mapped from hook
    editingItem,
    setEditingItem,
    isUploadingVideo,
    setIsUploadingVideo,
    handleEditClick,
    handleAddNewClick,
    handleSaveEdit,
    handleDeleteItem,
    handleUploadVideo,
  } = useStorage(false);

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items or locations..."
          className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3F62C7]/20 focus:border-[#3F62C7] transition-all"
        />
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-2xl">
        {(["items", "videos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
              activeTab === tab
                ? "bg-white text-[#3F62C7] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {isLoading ? (
          <StorageSkeleton />
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item: any) => (
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
                  <h4 className="font-bold text-slate-800 truncate">
                    {item.name}
                  </h4>
                  {/* Conditional "Seen By" Badge */}
                  {item.seen_by && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium uppercase">
                      By {item.seen_by}
                    </span>
                  )}
                </div>

                {/* Location Row - Added This Section */}
                {item.location && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                    <MapPin className="w-3 h-3 text-[#3F62C7]" />
                    <span className="text-[11px] font-medium truncate">
                      {item.location.surface}{" "}
                      <span className="text-slate-500">in</span>{" "}
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
                    handleEditClick(
                      item.id,
                      item.type || (activeTab === "items" ? "item" : "video"),
                      item.name,
                    )
                  }
                  className="p-2 text-slate-400 hover:text-[#3F62C7] bg-slate-50 hover:bg-[#eff6ff] rounded-full transition-colors shrink-0 outline-none"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* 3. Delete Button - Only show for items */}
                {item.type === "item" && (
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-full transition-colors shrink-0 outline-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Database className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm">
              No items found matching your search.
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {activeTab === "videos" && (
        <button
          onClick={handleAddNewClick}
          className="fixed bottom-24 right-4 bg-[#3F62C7] text-white p-4 rounded-full shadow-lg shadow-[#3F62C7]/30 hover:bg-[#3F62C7] hover:scale-105 active:scale-95 transition-all z-50 flex items-center justify-center"
          aria-label="Upload video"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      {editingItem && (
        <EditItemModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          initialName={editingItem.name}
          type={editingItem.type}
          onSave={handleSaveEdit}
        />
      )}

      <UploadVideoModal
        isOpen={isUploadingVideo}
        onClose={() => setIsUploadingVideo(false)}
        onUpload={handleUploadVideo}
      />
    </div>
  );
}
