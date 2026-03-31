'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadModel, detectObjects } from '@/lib/yoloModel';
import { DetectedObject } from '@/types/detection';
import DetectionCanvas from './DetectionCanvas';
import { Loader2, CameraOff } from 'lucide-react';

interface CameraViewProps {
  onObjectSelect: (obj: DetectedObject, videoElement: HTMLVideoElement) => void;
  selectedObjectId?: string | null;
  isActive: boolean;
}

export default function CameraView({ onObjectSelect, selectedObjectId, isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModel()
      .then(() => setIsModelLoaded(true))
      .catch((err) => setError('Failed to load detection model.'));
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera API not supported in this browser.');
          return;
        }

        // Detect if mobile to swap requested resolution orientation
        const isMobile = window.innerWidth < 768;
        
        const constraints = {
          video: { 
            facingMode: 'environment',
            width: isMobile ? { ideal: 1080 } : { ideal: 1920 },
            height: isMobile ? { ideal: 1920 } : { ideal: 1080 }
          },
          audio: false,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Auto-play failed, waiting for user interaction', playErr);
          }
        }
      } catch (err) {
        console.error('Camera Error:', err);
        setError(`Camera error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      setObjects([]);
    }
  }, [isActive]);

  const detectFrame = useCallback(async () => {
    if (videoRef.current && videoRef.current.readyState === 4 && isModelLoaded && isActive) {
      const detected = await detectObjects(videoRef.current);
      setObjects(detected);
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [isModelLoaded, isActive]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [detectFrame]);

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  };

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
      
      {/* Centered container that respects aspect ratio dynamically */}
      <div 
        className="relative flex items-center justify-center w-full h-full" 
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoLoad}
          className="w-full h-full object-contain"
        />
        {isModelLoaded && videoDimensions.width > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <DetectionCanvas
              objects={objects}
              videoWidth={videoDimensions.width}
              videoHeight={videoDimensions.height}
              onObjectClick={(obj) => {
                if (videoRef.current) {
                  onObjectSelect(obj, videoRef.current);
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