export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  class: string;
  score: number;
  bbox: BoundingBox;
}

export interface RegisteredItem {
  id: string;
  name: string;
  category: string;
  location: string;
  label: string;
  confidence: number;
  snapshotUrl: string;
  createdAt: number;
}

export interface ItemSavePayload {
  name: string;
  location: string;
}

export interface ItemModalProps {
  object: DetectedObject | null;
  snapshotUrl: string | null;
  onClose: () => void;
  onSave: (data: ItemSavePayload) => Promise<void>;
  defaultLocation?: string;
}
