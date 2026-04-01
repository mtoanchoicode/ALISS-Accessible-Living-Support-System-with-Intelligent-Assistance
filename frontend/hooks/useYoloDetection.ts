import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { loadModel, detectObjects } from "@/lib/yoloModel";
import { DetectedObject } from "@/types/detection";

export function useYoloDetection(isActive: boolean) {
  const webcamRef = useRef<Webcam>(null);
  const requestRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModel()
      .then(() => setIsModelLoaded(true))
      .catch((err) => setError("Failed to load detection model."));
  }, []);

  useEffect(() => {
    if (!isActive) {
      setObjects([]);
    }
  }, [isActive]);

  const detectFrame = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (video && video.readyState === 4 && isModelLoaded && isActive) {
      const detected = await detectObjects(video);
      setObjects(detected);
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [isModelLoaded, isActive]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [detectFrame]);

  const handleUserMedia = () => {
    const video = webcamRef.current?.video;
    if (video) {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  };

  const handleUserMediaError = (err: string | DOMException) => {
    setError(`Camera error: ${err.toString()}`);
  };

  return {
    webcamRef,
    isModelLoaded,
    objects,
    videoDimensions,
    error,
    handleUserMedia,
    handleUserMediaError,
  };
}
