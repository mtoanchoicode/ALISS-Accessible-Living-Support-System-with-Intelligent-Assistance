import { apiClient } from "./apiClient";
import { StorageVideo } from "@/types";

export const videoService = {
  getAllVideos: (): Promise<StorageVideo[]> => {
    return apiClient("/videos");
  },

  getVideo: (id: string): Promise<StorageVideo> => {
    return apiClient(`/videos/${id}`);
  },

  createVideo: (data: Partial<StorageVideo>): Promise<StorageVideo> => {
    return apiClient("/videos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  uploadVideo: (name: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);

    // Passed via apiClient without "content-type" defaults because of FormData instance check!
    return apiClient("/videos/upload", {
      method: "POST",
      body: formData,
    });
  },

  updateVideo: (id: string, data: Partial<StorageVideo>): Promise<StorageVideo> => {
    return apiClient(`/videos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteVideo: (id: string): Promise<any> => {
    return apiClient(`/videos/${id}`, {
      method: "DELETE",
    });
  }
};
