'use client';

import React from 'react';
import Webcam from 'react-webcam';
import { DetectedObject } from '@/types/detection';
import DetectionCanvas from './DetectionCanvas';
import { Loader2, CameraOff } from 'lucide-react';

interface CameraViewProps {
  webcamRef: React.RefObject<Webcam | null>;
  isModelLoaded: boolean;
  objects: DetectedObject[];
  videoDimensions: { width: number; height: number; };
  error: string | null;
  handleUserMedia: () => void;
  handleUserMediaError: (err: string | DOMException) => void;
  onObjectSelect: (obj: DetectedObject, videoElement: HTMLVideoElement) => void;
  selectedObjectId?: string | null;
  isActive: boolean;
  facingMode: "environment" | "user";
}

export default function CameraView({ 
  webcamRef, isModelLoaded, objects, videoDimensions, error, 
  handleUserMedia, handleUserMediaError, 
  onObjectSelect, selectedObjectId, isActive, facingMode 
}: CameraViewProps) {

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 rounded-2xl text-zinc-400 p-8 text-center">
        <CameraOff className="w-12 h-12 mb-4 text-zinc-500" />
        <p className="mb-6 text-sm leading-relaxed max-w-xs">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Retry Access
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
      {!isModelLoaded && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-500" />
          <p className="font-medium tracking-tight">Loading AI Model...</p>
        </div>
      )}
      
      <div className="relative flex items-center justify-center w-full h-full">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: facingMode,
            width: { ideal: typeof window !== 'undefined' && window.innerWidth < 768 ? 1080 : 1920 },
            height: { ideal: typeof window !== 'undefined' && window.innerWidth < 768 ? 1920 : 1080 }
          }}
          onUserMedia={handleUserMedia}
          onLoadedMetadata={handleUserMedia}
          className="w-full h-full object-cover" 
        />
        {isModelLoaded && videoDimensions.width > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <DetectionCanvas
              objects={objects}
              videoWidth={videoDimensions.width}
              videoHeight={videoDimensions.height}
              onObjectClick={(obj) => {
                if (webcamRef.current?.video) {
                  onObjectSelect(obj, webcamRef.current.video);
                }
              }}
              selectedObjectId={selectedObjectId}
            />
          </div>
        )}
      </div>
    </div>
  );
}