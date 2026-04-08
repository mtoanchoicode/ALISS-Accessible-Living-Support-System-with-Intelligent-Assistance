"use client";

import { Plus } from "lucide-react";
import StorageSkeleton from "@/components/StorageSkeleton";
import { SearchBar } from "@/components/storage/SearchBar";
import { Tabs } from "@/components/storage/Tabs";
import { StorageEmptyState } from "@/components/storage/StorageEmptyState";
import { StorageItemCard } from "@/components/storage/StorageItemCard";
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
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <Tabs
        tabs={["items", "videos"] as const}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Items List */}
      <div className="space-y-3">
        {isLoading ? (
          <StorageSkeleton />
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item: any) => (
            <StorageItemCard
              key={item.id}
              item={item}
              onEdit={handleEditClick}
              onDelete={handleDeleteItem}
              activeTab={activeTab}
            />
          ))
        ) : (
          <StorageEmptyState />
        )}
      </div>

      {/* Floating Action Button */}
      {activeTab === "videos" && (
        <button
          onClick={handleAddNewClick}
          className="fixed bottom-24 right-4 bg-primary text-white p-4 rounded-full shadow-md shadow-primary/30 active:scale-95 transition-all duration-200 z-50 flex items-center justify-center"
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
