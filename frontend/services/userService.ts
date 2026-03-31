import { apiClient } from "./apiClient";
import { UserProfile } from "@/types";

export const userService = {
  // ... add update and delete here
  getUser: (): Promise<UserProfile[]> => {
    return apiClient("/users")
  }
};
