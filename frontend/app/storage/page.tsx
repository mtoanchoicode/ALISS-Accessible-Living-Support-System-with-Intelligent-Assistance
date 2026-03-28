"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Database,
  Search,
  Video,
  Package,
  Clock,
  MapPin,
  MoreVertical,
} from "lucide-react";
import { StorageItem, StorageVideo } from "@/types";
import { itemService } from "@/services/itemService";
import { videoService } from "@/services/videoService";
import StorageSkeleton from "@/components/StorageSkeleton";

export default function StoragePage() {
  const [activeTab, setActiveTab] = useState<"items" | "videos">("items");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<StorageItem[]>([]);
  const [videos, setVideos] = useState<StorageVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);

        const [backendItems, backendVideos] = await Promise.all([
          itemService.getAllItems(),
          videoService.getAllVideos(),
        ]);

        setItems((backendItems || []).map((i) => ({ ...i, type: "item" })));
        setVideos((backendVideos || []).map((v) => ({ ...v, type: "video" })));
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const currentSource = activeTab === "items" ? items : videos;

  const filteredItems = currentSource.filter((item) => {
    const matchesSearch = item.name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

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
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                {/* Type-Safe Check */}
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
                  <Package className="..." />
                )}
              </div>

              <div className="flex-1">
                <h4 className="font-bold">{item.name}</h4>
                <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  {/* <span>{item.categories?.name || "Uncategorized"}</span>
                  <span>•</span> */}
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
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
    </div>
  );
}
