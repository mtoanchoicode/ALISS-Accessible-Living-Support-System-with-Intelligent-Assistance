import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { itemService } from "@/services/itemService";
import { videoService } from "@/services/videoService";

export function useStorage(isChecking: boolean) {
  const queryClient = useQueryClient();

  const { data: rawItems = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['items'],
    queryFn: itemService.getAllItems,
    enabled: !isChecking,
  });

  const { data: rawVideos = [], isLoading: videosLoading, error: videosError } = useQuery({
    queryKey: ['videos'],
    queryFn: videoService.getAllVideos,
    enabled: !isChecking,
  });

  const items = rawItems.map((i: any) => ({ ...i, type: "item" }));
  const videos = rawVideos.map((v: any) => ({ ...v, type: "video" }));

  const isLoading = itemsLoading || videosLoading;
  const error = itemsError || videosError ? "Failed to load storage data." : null;

  // Search & Tabs
  const [activeTab, setActiveTab] = useState<"items" | "videos">("items");
  const [searchQuery, setSearchQuery] = useState("");
  const currentSource = activeTab === "items" ? items : videos;
  const filteredItems = currentSource.filter((item: any) => {
    return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Actions
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; type: "item" | "video" } | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const handleEditClick = (id: string, type: "item" | "video", currentName: string) => {
    setEditingItem({ id, name: currentName, type });
  };

  const handleAddNewClick = () => {
    if (activeTab === "items") {
      alert("Adding items flow to be implemented.");
    } else {
      setIsUploadingVideo(true);
    }
  };

  const updateItemMutation = useMutation({
    mutationFn: ({ id, name }: { id: string, name: string }) => itemService.updateItem(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, name }: { id: string, name: string }) => videoService.updateVideo(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  });

  const uploadVideoMutation = useMutation({
    mutationFn: ({ name, file }: { name: string, file: File }) => videoService.uploadVideo(name, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  });

  const handleSaveEdit = async (newName: string) => {
    if (!editingItem) return;
    if (editingItem.type === "item") {
      await updateItemMutation.mutateAsync({ id: editingItem.id, name: newName });
    } else {
      await updateVideoMutation.mutateAsync({ id: editingItem.id, name: newName });
    }
    setEditingItem(null); 
  };

  const handleUploadVideo = async (name: string, file: File) => {
    await uploadVideoMutation.mutateAsync({ name, file });
    setIsUploadingVideo(false);
  };

  return {
    items, videos, isLoading, error, 
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
    activeTab, setActiveTab, searchQuery, setSearchQuery, filteredItems,
    editingItem, setEditingItem, isUploadingVideo, setIsUploadingVideo,
    handleEditClick, handleAddNewClick, handleSaveEdit, handleUploadVideo
  };
}
