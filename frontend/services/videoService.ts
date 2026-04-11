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

  uploadVideo: (
    file_1: File, 
    file_2: File, 
    location_1?: string, 
    location_2?: string
  ): Promise<any> => {
    const formData = new FormData();
    formData.append("file_1", file_1);
    formData.append("file_2", file_2);
    
    if (location_1) {
      formData.append("location_1", location_1);
    }
    if (location_2) {
      formData.append("location_2", location_2);
    }

    return apiClient("/videos/activity", {
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
