import React, { useRef, useEffect } from 'react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    objects.forEach((obj) => {
      const { x, y, width, height } = obj.bbox;
      const isSelected = obj.id === selectedObjectId;
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeStyle = isSelected ? '#10b981' : '#ef4444';
      ctx.fillStyle = isSelected
        ? 'rgba(16, 185, 129, 0.2)'
        : 'rgba(239, 68, 68, 0.1)';

      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.fill();
      ctx.stroke();

      const label = `${obj.class} ${Math.round(obj.score * 100)}%`;
      ctx.font = '16px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x, y - 24, textWidth + 8, 24);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 4, y - 6);
    });
  }, [objects, selectedObjectId, videoWidth, videoHeight]);

  const handleInteraction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the actual scale of the canvas vs its display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const clicked = [...objects].reverse().find((obj) => isPointInBox(x, y, obj.bbox));
    if (clicked) {
      onObjectClick(clicked);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleInteraction(e.clientX, e.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent default to avoid double-firing click events on mobile
    e.preventDefault();
    if (e.changedTouches.length > 0) {
      handleInteraction(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain'
      }}
      className={`absolute top-0 left-0 z-10 touch-none ${className}`}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    />
  );
}