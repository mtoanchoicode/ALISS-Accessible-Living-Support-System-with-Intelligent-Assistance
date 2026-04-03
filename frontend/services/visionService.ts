import { apiClient } from "./apiClient";

export const visionService = {
  createMemory: async (objName: string, location: string, imageFile: File, model: string = "gpt-4o") => {
    const formData = new FormData();
    formData.append("obj_name", objName);
    formData.append("location", location);
    formData.append("image", imageFile);
    formData.append("model", model);

    return apiClient("/memory", {
      method: "POST",
      body: formData,
    });
  },

  createMemoryV2: async (
    objName: string, 
    location: string, 
    imageFile: File, 
    timestamp?: number, 
    model: string = "gpt-4o"
  ) => {
    const time = timestamp || Date.now() / 1000;
    const formData = new FormData();
    formData.append("obj_name", objName);
    formData.append("location", location);
    formData.append("image", imageFile);
    formData.append("timestamp", time.toString());
    formData.append("model", model);

    return apiClient("/memoryv2", {
      method: "POST",
      body: formData,
    });
  }
};
