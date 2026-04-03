import { apiClient } from "./apiClient";
import { StorageItem } from "../types";

export const itemService = {
  getAllItems: (): Promise<StorageItem[]> => {
    return apiClient("/items");
  },

  getItem: (id: string): Promise<StorageItem> => {
    return apiClient(`/items/${id}`);
  },

  createItem: (data: Partial<StorageItem>): Promise<StorageItem> => {
    return apiClient("/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateItem: (id: string, data: Partial<StorageItem>): Promise<StorageItem> => {
    return apiClient(`/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteItem: (id: string): Promise<any> => {
    return apiClient(`/items/${id}`, {
      method: "DELETE",
    });
  }
};
