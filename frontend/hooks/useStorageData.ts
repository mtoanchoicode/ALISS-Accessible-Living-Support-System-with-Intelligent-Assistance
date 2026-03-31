import { useState, useEffect, useCallback } from "react";
import { StorageItem, StorageVideo } from "@/types";
import { itemService } from "@/services/itemService";
import { videoService } from "@/services/videoService";

export function useStorageData(isChecking: boolean) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [videos, setVideos] = useState<StorageVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [backendItems, backendVideos] = await Promise.all([
        itemService.getAllItems(),
        videoService.getAllVideos(),
      ]);

      setItems((backendItems || []).map((i: any) => ({ ...i, type: "item" })));
      setVideos((backendVideos || []).map((v: any) => ({ ...v, type: "video" })));
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load storage data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isChecking) return;
    fetchAllData();
  }, [isChecking, fetchAllData]);

  return { items, videos, isLoading, error, refetch: fetchAllData };
}