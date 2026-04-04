import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { loadModel, detectObjects } from "@/lib/yoloModel";
import { DetectedObject, RegisteredItem } from "@/types/detection";
import { captureSnapshot, captureFullSnapshot } from "@/lib/detectionUtils";
import { saveRegisteredItem } from "@/lib/storageUtils";
import { visionService } from "@/services/visionService";
import { itemService } from "@/services/itemService";

export function useCamera() {
  // --- Global Camera Controls ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectedRoom, setSelectedRoom] = useState<string>("Living Room");

  // --- YOLO AI Detection State ---
  const webcamRef = useRef<Webcam>(null);
  const requestRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const objectsRef = useRef<DetectedObject[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  // --- Initialization & TF.js ---
  useEffect(() => {
    loadModel()
      .then(() => setIsModelLoaded(true))
      .catch((err) => setError("Failed to load detection model."));
  }, []);

  useEffect(() => {
    if (!isCameraActive) {
      setObjects([]);
    }
  }, [isCameraActive]);

  const detectFrame = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (video && video.readyState === 4 && isModelLoaded && isCameraActive) {
      const detected = await detectObjects(video);
      setObjects(detected);
      objectsRef.current = detected;
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [isModelLoaded, isCameraActive]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [detectFrame]);

  // --- Background Context Builder (MemoryV2) ---
  // useEffect(() => {
  //   if (!isCameraActive || isRecording) return; // Pause context building while explicitly recording video

  //   const timer = setInterval(async () => {
  //     const video = webcamRef.current?.video;
  //     if (!video) return;

  //     try {
  //       const uniqueNames = Array.from(new Set(objectsRef.current.map(o => o.class)));
  //       const objNameStr = uniqueNames.length > 0 ? uniqueNames.join(", ") : "background";

  //       const snap = captureFullSnapshot(video); // takes full frame snapshot
  //       const res = await fetch(snap);
  //       const blob = await res.blob();
  //       const file = new File([blob], `context_${Date.now()}.jpg`, { type: "image/jpeg" });

  //       await visionService.createMemoryV2(objNameStr, selectedRoom, file);
  //     } catch (err) {
  //       console.error("Context builder failed", err);
  //     }
  //   }, 4000);

  //   return () => clearInterval(timer);
  // }, [isCameraActive, isRecording, selectedRoom]);

  // --- Utility & Event Handlers ---
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

  // --- Recording Logic (from useCameraControls) ---
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

  const handleSaveItem = async (itemData: Omit<RegisteredItem, "id" | "createdAt">) => {
    saveRegisteredItem(itemData); // Local redundancy tracking
    
    try {
      // Map to correct API fields depending on your DB. StorageItem expects 'name'.
      await itemService.createItem({
        name: itemData.name
      } as any);
    } catch (e) {
      console.error("Failed to post to backend DB items collection:", e);
    }
    
    if (snapshotUrl) {
       try {
           const res = await fetch(snapshotUrl);
           const blob = await res.blob();

           const file = new File([blob], `${itemData.name}.jpg`, { type: "image/jpeg" });
           visionService.createMemoryV2(itemData.name, itemData.category || "Unknown Location", file).catch(e => console.error("Vision Processing Sync Failed:", e));
       } catch (err) {
           console.error("Failed to construct image blob bounds: ", err);
       }
    }
    
    setSelectedObject(null);
    setSnapshotUrl(null);
    setIsCameraActive(true);
  };

  const handleCloseModal = () => {
    setSelectedObject(null);
    setSnapshotUrl(null);
    setIsCameraActive(true);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const toggleCameraActive = () => {
    setIsCameraActive((prev) => !prev);
  };

  return {
    // Media & Vision
    webcamRef, isModelLoaded, objects, videoDimensions, error,
    handleUserMedia, handleUserMediaError,
    // Controls
    isRecording, recordingTime, toggleRecording,
    facingMode, toggleFacingMode,
    isCameraActive, toggleCameraActive,
    toggleFullScreen,
    selectedRoom, setSelectedRoom,
    // Storage Mappings
    selectedObject, snapshotUrl, handleObjectSelect, handleSaveItem, handleCloseModal
  };
}
