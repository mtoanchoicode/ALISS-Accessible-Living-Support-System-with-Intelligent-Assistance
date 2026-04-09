"use client";

import React from "react";
import { Camera } from "react-camera-pro";
import { DetectedObject } from "@/types/detection";
import DetectionCanvas from "./DetectionCanvas";
import { Loader2, CameraOff } from "lucide-react";

interface CameraViewProps {
  webcamRef: React.RefObject<any>;
  isModelLoaded: boolean;
  objects: DetectedObject[];
  videoDimensions: { width: number; height: number };
  error: string | null;
  handleUserMedia: () => void;
  handleUserMediaError: (err: string | DOMException) => void;
  onObjectSelect: (obj: DetectedObject, videoElement: HTMLVideoElement) => void;
  selectedObjectId?: string | null;
  isActive: boolean;
  facingMode: "environment" | "user";
}

export default function CameraView({
  webcamRef,
  isModelLoaded,
  objects,
  videoDimensions,
  error,
  handleUserMedia,
  handleUserMediaError,
  onObjectSelect,
  selectedObjectId,
  isActive,
  facingMode,
}: CameraViewProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 rounded-2xl text-zinc-400 p-8 text-center">
        <CameraOff className="w-12 h-12 mb-4 text-zinc-500" />
        <p className="mb-6 text-sm leading-relaxed max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:shadow-md active:scale-95 transition-all duration-200"
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
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-azure" />
          <p className="font-medium tracking-tight">Loading AI Model...</p>
        </div>
      )}

      <div className="relative flex items-center justify-center w-full h-full">
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black flex items-center justify-center">
          <Camera
            ref={webcamRef}
            facingMode={facingMode}
            aspectRatio="cover"
            errorMessages={{}}
            videoReadyCallback={handleUserMedia}
          />
        </div>
        {isModelLoaded && videoDimensions.width > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <DetectionCanvas
              objects={objects}
              videoWidth={videoDimensions.width}
              videoHeight={videoDimensions.height}
              onObjectClick={(obj) => {
                const video = document.querySelector("video");
                if (video) {
                  onObjectSelect(obj, video);
                }
              }}
              selectedObjectId={selectedObjectId}
              className="absolute top-0 left-0 w-full h-full pointer-events-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
}
