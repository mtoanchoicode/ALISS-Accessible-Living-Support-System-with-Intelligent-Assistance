import { useState, useEffect } from "react";
import { DetectedObject, RegisteredItem } from "@/types/detection";
import { captureSnapshot } from "@/lib/detectionUtils";
import { saveRegisteredItem } from "@/lib/storageUtils";

export function useCameraControls() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Timer for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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

  const handleSaveItem = (itemData: Omit<RegisteredItem, "id" | "createdAt">) => {
    saveRegisteredItem(itemData);
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
    isRecording,
    recordingTime,
    selectedObject,
    snapshotUrl,
    isCameraActive,
    facingMode,
    toggleRecording,
    handleObjectSelect,
    handleSaveItem,
    handleCloseModal,
    toggleFullScreen,
    toggleFacingMode,
    toggleCameraActive,
  };
}
