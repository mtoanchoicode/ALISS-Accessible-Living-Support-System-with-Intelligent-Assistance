import { apiClient } from "./apiClient";
import { UserProfile } from "@/types";

export const userService = {
  getUserProfile: (id: string): Promise<UserProfile> => {
    return apiClient(`/users/${id}`);
  }
};
