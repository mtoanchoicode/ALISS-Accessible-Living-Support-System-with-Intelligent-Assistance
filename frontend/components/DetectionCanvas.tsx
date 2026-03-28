import React, { useRef, useEffect, useState } from 'react';
import { DetectedObject } from '@/types/detection';
import { isPointInBox } from '../lib/detectionUtils';

interface DetectionCanvasProps {
  objects: DetectedObject[];
  videoWidth: number;
  videoHeight: number;
  onObjectClick: (obj: DetectedObject) => void;
  selectedObjectId?: string | null;
  className?: string;
}

export default function DetectionCanvas({
  objects,
  videoWidth,
  videoHeight,
  onObjectClick,
  selectedObjectId,
  className = '',
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Only draw if we have objects and we are active
    // We don't have an 'isActive' prop here, but objects will be empty if not active in parent
    objects.forEach((obj) => {
      const { x, y, width, height } = obj.bbox;
      const isSelected = obj.id === selectedObjectId;
      const isHovered = obj.id === hoveredObjectId;

      // Box styling
      ctx.lineWidth = isSelected ? 4 : isHovered ? 3 : 2;
      ctx.strokeStyle = isSelected ? '#10b981' : isHovered ? '#3b82f6' : '#ef4444';
      ctx.fillStyle = isSelected
        ? 'rgba(16, 185, 129, 0.2)'
        : isHovered
        ? 'rgba(59, 130, 246, 0.2)'
        : 'rgba(239, 68, 68, 0.1)';

      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.stroke();

      // Label background
      const label = `${obj.class} ${Math.round(obj.score * 100)}%`;
      ctx.font = '16px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x, y - 24, textWidth + 8, 24);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 4, y - 6);
    });
  }, [objects, hoveredObjectId, selectedObjectId, videoWidth, videoHeight]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find topmost object
    const hovered = [...objects].reverse().find((obj) => isPointInBox(x, y, obj.bbox));
    setHoveredObjectId(hovered ? hovered.id : null);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clicked = [...objects].reverse().find((obj) => isPointInBox(x, y, obj.bbox));
    if (clicked) {
      onObjectClick(clicked);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      className={`absolute top-0 left-0 w-full h-full z-10 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredObjectId(null)}
      onClick={handleClick}
    />
  );
}
