// frontend/services/visionService.ts

export const visionService = {
  createMemory: async (objName: string, location: string, imageFile: File, model: string = "gpt-4o") => {
    const formData = new FormData();
    formData.append("obj_name", objName);
    formData.append("location", location);
    formData.append("image", imageFile);
    formData.append("model", model);

    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://172.16.1.236:8000";
    const response = await fetch(`${BASE_URL}/memory`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
        throw new Error("Failed to create memory");
    }
    return response.json();
  },

  createMemoryV2: async (
    objName: string, 
    location: string, 
    imageFile: File, 
    userId: string = "user", 
    timestamp?: number, 
    model: string = "gpt-4o"
  ) => {
    const time = timestamp || Date.now() / 1000;
    const formData = new FormData();
    formData.append("obj_name", objName);
    formData.append("location", location);
    formData.append("image", imageFile);
    formData.append("user_id", userId);
    formData.append("timestamp", time.toString());
    formData.append("model", model);

    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://172.16.1.236:8000";
    const response = await fetch(`${BASE_URL}/memoryv2`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
        throw new Error("Failed to create memory v2");
    }
    return response.json();
  }
};
