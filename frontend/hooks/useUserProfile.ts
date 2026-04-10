import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { UserProfile } from "@/types";

// Shared query key constant — ensures all consumers hit the same cache slot.
export const USER_PROFILE_KEY = ["userProfile"] as const;

export function useUserProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Data Fetching via useQuery — deduplicated, cached, and synchronized
  //    across all components that call useUserProfile().
  const {
    data: profile,
    isLoading,
  } = useQuery<UserProfile>({
    queryKey: USER_PROFILE_KEY,
    queryFn: userService.getUserProfile,
  });

  // 2. Edit States (local to the editing form)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 3. Auth States
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sync local edit states when the profile data first arrives or updates
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      if (profile.image_uri) setAvatarPreview(profile.image_uri);
    }
  }, [profile]);

  const getInitials = (first?: string, last?: string) => {
    if (!first && !last) return "";
    return ((first?.charAt(0) || "") + (last?.charAt(0) || "")).toUpperCase();
  };
  const initials = getInitials(profile?.first_name, profile?.last_name);

  // --- Edit Actions ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // --- Helper: Convert File to Base64 String ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // --- Profile Update Mutation ---
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: Partial<UserProfile> & { image_uri?: string }) => {
      return userService.updateUserProfile(payload);
    },
    onSuccess: (updatedData) => {
      // Immediately update the cached profile so all consumers see new data.
      queryClient.setQueryData(USER_PROFILE_KEY, updatedData);
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatePayload: any = {
        first_name: firstName,
        last_name: lastName,
      };

      if (selectedFile) {
        updatePayload.image_uri = await fileToBase64(selectedFile);
      }

      await updateProfileMutation.mutateAsync(updatePayload);

      // Cache is already updated via onSuccess.
      // router.refresh() ensures Next.js server components also pick up
      // the new data, eliminating the flash-of-stale-content race condition.
      router.refresh();
      router.push("/profile");
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  // --- Auth Actions ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    profile,
    initials,
    isLoading,
    // Auth mapping
    isLoggingOut,
    handleLogout,
    // Edit mapping
    firstName,
    setFirstName,
    lastName,
    setLastName,
    avatarPreview,
    isSaving: updateProfileMutation.isPending,
    handleImageChange,
    handleSave,
  };
}
