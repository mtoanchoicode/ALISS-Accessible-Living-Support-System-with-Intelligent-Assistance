import { apiClient } from "./apiClient";
import { StorageVideo } from "@/types";

export const videoService = {
  getAllVideos: (): Promise<StorageVideo[]> => {
    return apiClient("/videos"); // Ensure your Python BE has this route
  },
};
