import { BoundingBox } from '@/types/detection';

export function isPointInBox(x: number, y: number, box: BoundingBox): boolean {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
}

export function captureSnapshot(video: HTMLVideoElement, box: BoundingBox): string {
  const canvas = document.createElement('canvas');
  // Add some padding
  const padding = 20;
  const sx = Math.max(0, box.x - padding);
  const sy = Math.max(0, box.y - padding);
  const sw = Math.min(video.videoWidth - sx, box.width + padding * 2);
  const sh = Math.min(video.videoHeight - sy, box.height + padding * 2);

  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/jpeg', 0.8);
  }
  return '';
}
