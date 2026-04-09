import { useState, useEffect, useRef, useCallback } from "react";
import { CameraType } from "react-camera-pro";
import { DetectedObject, ItemSavePayload } from "@/types/detection";
import { captureSnapshot } from "@/lib/detectionUtils";
import { visionService } from "@/services/visionService";

export function useCamera() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(
    null,
  );
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [selectedRoom, setSelectedRoom] = useState<string>("Living Room");

  // --- YOLO AI Detection State ---
  const webcamRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>(0);
  const isDetectingRef = useRef<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const objectsRef = useRef<DetectedObject[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // --- Initialization & TF.js via Web Worker ---
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/yoloWorker.ts', import.meta.url));

    workerRef.current.onmessage = (e) => {
      const { type, objects: detectedData, error: workerErr } = e.data;
      if (type === "LOADED") {
        setIsModelLoaded(true);
      } else if (type === "RESULT") {
        setObjects(detectedData);
        objectsRef.current = detectedData;
        isDetectingRef.current = false;
      } else if (type === "ERROR") {
        setError("AI Model Error: " + workerErr);
      }
    };

    workerRef.current.postMessage({ type: "INIT" });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!isCameraActive) {
      setObjects([]);
    }
  }, [isCameraActive]);

  const detectFrame = useCallback(async () => {
    const video = document.querySelector("video");
    if (video && video.readyState === 4 && isModelLoaded && isCameraActive && !isDetectingRef.current) {
      isDetectingRef.current = true;
      try {
        const bitmap = await createImageBitmap(video);
        workerRef.current?.postMessage({
          type: "DETECT",
          payload: {
            bitmap,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          }
        }, [bitmap]);
      } catch (e) {
        isDetectingRef.current = false;
      }
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [isModelLoaded, isCameraActive]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [detectFrame]);

  // --- Utility & Event Handlers ---
  const handleUserMedia = () => {
    const video = document.querySelector("video");
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

  // --- Recording Logic ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingTime(0);
    } else {
      setIsRecording(true);
    }
  };

  const handleObjectSelect = (obj: DetectedObject, video: HTMLVideoElement) => {
    if (isRecording) return;
    setSelectedObject(obj);
    setIsCameraActive(false);

    const snap = captureSnapshot(video, obj.bbox);
    setSnapshotUrl(snap);
  };

  const handleSaveItem = async (itemData: ItemSavePayload) => {
    if (!snapshotUrl) {
      console.error("No snapshot available to save.");
      return;
    }

    try {
      // 1. Convert the Base64 snapshot into a raw File object
      const res = await fetch(snapshotUrl);
      const blob = await res.blob();

      // Clean up the filename (e.g. "Coffee Mug" -> "Coffee_Mug.jpg")
      const safeFilename = `${itemData.name.replace(/\s+/g, "_")}.jpg`;
      const file = new File([blob], safeFilename, { type: "image/jpeg" });

      // 2. Call the memory v2 API directly (which uses FormData)
      await visionService.createMemoryV2(
        itemData.name,
        itemData.location,
        file,
      );

      // 3. Success! Close modal and resume camera
      setSelectedObject(null);
      setSnapshotUrl(null);
      setIsCameraActive(true);
    } catch (e) {
      console.error("Failed to process memory via v2 API:", e);
      throw e;
    }
  };

  const handleCloseModal = () => {
    setSelectedObject(null);
    setSnapshotUrl(null);
    setIsCameraActive(true);
  };

  const toggleCameraActive = () => {
    setIsCameraActive((prev) => !prev);
  };

  return {
    // Media & Vision
    webcamRef,
    isModelLoaded,
    objects,
    videoDimensions,
    error,
    handleUserMedia,
    handleUserMediaError,
    // Controls
    isRecording,
    recordingTime,
    toggleRecording,
    facingMode,
    isCameraActive,
    toggleCameraActive,
    selectedRoom,
    setSelectedRoom,
    // Storage Mappings
    selectedObject,
    snapshotUrl,
    handleObjectSelect,
    handleSaveItem,
    handleCloseModal,
  };
}