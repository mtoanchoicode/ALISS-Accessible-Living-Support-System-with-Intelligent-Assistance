import { useState } from "react";
import { useStorageData } from "@/hooks/useStorageData";

export function useStorageSearch() {
  const { items, videos, isLoading } = useStorageData(false);

  const [activeTab, setActiveTab] = useState<"items" | "videos">("items");
  const [searchQuery, setSearchQuery] = useState("");

  const currentSource = activeTab === "items" ? items : videos;

  const filteredItems = currentSource.filter((item: any) => {
    return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleEdit = (id: string, type: "item" | "video") => {
    const newName = prompt(`Editing ${type}. Enter new name:`);
    if (newName) {
      console.log(`Update ${type} ${id} to ${newName}`);
      // Integration target: itemService.updateItem or videoService.updateVideo
    }
  };

  const handleAddNew = () => {
    const type = activeTab === "items" ? "item" : "video";
    const name = prompt(`Add new ${type}:`);
    if (name) {
      console.log(`Create new ${type}: ${name}`);
      // Integration target: itemService.createItem or videoService.createVideo
    }
  };

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredItems,
    isLoading,
    handleEdit,
    handleAddNew,
  };
}
