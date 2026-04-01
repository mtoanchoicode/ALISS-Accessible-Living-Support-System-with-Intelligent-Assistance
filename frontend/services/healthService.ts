import { apiClient } from "./apiClient";

export const healthService = {
  checkHealth: async () => {
    return apiClient("/health");
  }
};
