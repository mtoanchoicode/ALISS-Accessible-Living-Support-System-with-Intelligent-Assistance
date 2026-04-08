import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { UserProfile } from "@/types";

export function useUserProfile() {
  const router = useRouter();

  // 1. Data States
  const [profile, setProfile] = useState<UserProfile>();
  const [isLoading, setIsLoading] = useState(true);

  // 2. Edit States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 3. Auth States
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Initializers ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getUserProfile();
        setProfile(data);

        // Sync local edit states automatically
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        if (data.image_uri) setAvatarPreview(data.image_uri);
      } catch (error) {
        console.error("Failed to load user profile:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

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

  // --- Edit Actions ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      // We use 'any' here temporarily so TypeScript doesn't complain about the new avatar_base64 field
      const updatePayload: any = {
        first_name: firstName,
        last_name: lastName,
      };

      // If they picked a new image, encode it and pack it into the JSON
      if (selectedFile) {
        updatePayload.image_uri = await fileToBase64(selectedFile);
      }

      const updatedData = await userService.updateUserProfile(updatePayload);
      setProfile(updatedData);

      router.push("/profile");
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Auth Actions ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logoutApi();
      authService.logout();
      router.push("/");
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
    isSaving,
    handleImageChange,
    handleSave,
  };
}
