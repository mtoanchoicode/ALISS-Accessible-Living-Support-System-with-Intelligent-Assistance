export type StorageItem = {
  id: string;
  owner_id: string;
  category_id: number;
  name: string;
  image_uri: string;
  created_at: string;
  type: "item";
  categories?: { name: string };
};

export type StorageVideo = {
  id: string;
  user_id: string;
  source_type: "wearable" | "cctv" | "mobile";
  video_uri: string;
  duration_seconds: string;
  name: string;
  created_at: string;
  type: "video";
};

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  image_uri: string;
}
