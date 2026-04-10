import { apiClient } from "./apiClient";
import { StorageItem } from "../types";

export const itemService = {
  getAllItems: async () => {
    const data = await apiClient("/memoryv2/objects");
    // We return the 'objects' array specifically to keep the hook logic clean
    return data.objects || [];
  },

  getItem: (id: string): Promise<StorageItem> => {
    return apiClient(`/items/${id}`);
  },

  createItem: (data: Partial<StorageItem>): Promise<StorageItem> => {
    return apiClient("/memoryv2", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateItem: (id: string, updates: any): Promise<any> => {
    return apiClient("/memoryv2/object", {
      method: "PUT",
      body: JSON.stringify({
        node_id: id,
        updates: updates,
      }),
    });
  },

  deleteItem: (id: string): Promise<any> => {
    return apiClient(`/memoryv2/object/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
};
