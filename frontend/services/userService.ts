import { apiClient } from "./apiClient";
import { UserProfile } from "@/types";

export const userService = {
  getUserProfile: (): Promise<UserProfile> => {
    return apiClient(`/users/me`);
  },
  updateUserProfile: (data: Partial<UserProfile>): Promise<UserProfile> => {
    return apiClient(`/users/me`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }
};
