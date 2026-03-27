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
  label: string;
  confidence: number;
  snapshotUrl: string;
  createdAt: number;
}
