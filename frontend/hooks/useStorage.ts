import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { itemService } from "@/services/itemService";
import { videoService } from "@/services/videoService";

export function useStorage(isChecking: boolean) {
  const queryClient = useQueryClient();

  const {
    data: rawItems = [],
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery({
    queryKey: ["items"],
    queryFn: itemService.getAllItems,
    enabled: !isChecking,
  });

  const {
    data: rawVideos = [],
    isLoading: videosLoading,
    error: videosError,
  } = useQuery({
    queryKey: ["videos"],
    queryFn: videoService.getAllVideos,
    enabled: !isChecking,
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const items = rawItems.map((i: any) => ({ ...i, type: "item", id: i.id }));
  const videos = rawVideos.map((v: any) => ({ ...v, type: "video" }));

  const isLoading = itemsLoading || videosLoading;
  const error =
    itemsError || videosError ? "Failed to load storage data." : null;

  const [activeTab, setActiveTab] = useState<"items" | "videos">("items");
  const [searchQuery, setSearchQuery] = useState("");
  const currentSource = activeTab === "items" ? items : videos;

  const filteredItems = currentSource.filter((item: any) => {
    return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    type: "item" | "video";
  } | null>(null);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const handleEditClick = (
    id: string,
    type: "item" | "video",
    currentName: string,
  ) => {
    setEditingItem({ id, name: currentName, type });
  };

  const handleAddNewClick = () => {
    if (activeTab === "items") {
      // Items should be added via the AI Camera!
      console.log(
        "Please go to the Camera tab to scan and register new items.",
      );
    } else {
      setIsUploadingVideo(true);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItemMutation.mutateAsync(id);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const updateItemMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      itemService.updateItem(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => itemService.deleteItem(id),
    onSuccess: () => {
      // Invalidate the "items" query to refresh the list automatically
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const uploadItemMutation = useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      // Convert the image to text so it fits in the JSON payload
      const image_base64 = await fileToBase64(file);

      return itemService.createItem({
        name: name,
        image_uri: image_base64,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      videoService.updateVideo(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
  });

  const uploadVideoMutation = useMutation({
    mutationFn: ({ name, file, location }: { name: string; file: File; location?: string }) =>
      videoService.uploadVideo(name, file, location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
  });

  const handleSaveEdit = async (newName: string) => {
    if (!editingItem) return;
    if (editingItem.type === "item") {
      await updateItemMutation.mutateAsync({
        id: editingItem.id,
        name: newName,
      });
    } else {
      await updateVideoMutation.mutateAsync({
        id: editingItem.id,
        name: newName,
      });
    }
    setEditingItem(null);
  };

  const handleUploadVideo = async (name: string, file: File, location?: string) => {
    await uploadVideoMutation.mutateAsync({ name, file, location });
    setIsUploadingVideo(false);
  };

  return {
    items,
    videos,
    isLoading,
    error,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredItems,
    editingItem,
    setEditingItem,
    isUploadingVideo,
    setIsUploadingVideo,
    handleEditClick,
    handleAddNewClick,
    handleSaveEdit,
    handleUploadVideo,
    handleDeleteItem,
  };
}
