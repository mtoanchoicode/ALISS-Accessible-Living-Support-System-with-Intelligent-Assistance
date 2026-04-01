"use client";

import { motion } from "motion/react";
import {
  Database,
  Search,
  Video,
  Package,
  Pencil,
  Plus
} from "lucide-react";
import StorageSkeleton from "@/components/StorageSkeleton";
import { useStorageSearch } from "@/hooks/useStorageSearch";

export default function StoragePage() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredItems,
    isLoading,
    handleEdit,
    handleAddNew,
  } = useStorageSearch();

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
          className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                ? "bg-white text-teal-600 shadow-sm"
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
                    src={item.image_uri}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : item.type === "video" ? (
                  <div className="bg-blue-50 w-full h-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-blue-500" />
                  </div>
                ) : (
                  <Package className="w-6 h-6 text-slate-400" />
                )}
              </div>

              <div className="flex-1">
                <h4 className="font-bold">{item.name}</h4>
                <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <button 
                onClick={() => handleEdit(item.id, item.type || (activeTab === 'items' ? 'item' : 'video'))}
                className="p-2 text-slate-400 hover:text-teal-600 bg-slate-50 hover:bg-teal-50 rounded-full transition-colors shrink-0 outline-none"
              >
                <Pencil className="w-4 h-4" />
              </button>
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
      <button 
        onClick={handleAddNew}
        className="fixed bottom-24 right-4 bg-teal-600 text-white p-4 rounded-full shadow-lg shadow-teal-600/30 hover:bg-teal-700 hover:scale-105 active:scale-95 transition-all z-50 flex items-center justify-center"
        aria-label={activeTab === 'items' ? "Add new item" : "Upload video"}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}