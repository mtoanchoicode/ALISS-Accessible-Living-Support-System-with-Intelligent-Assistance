"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { StopCircle, RefreshCw, Maximize2, Settings2 } from "lucide-react";

import CameraView from "../../components/CameraView";
import ItemModal from "@/components/ItemModal";
import { DetectedObject, RegisteredItem } from "@/types/detection";
import { captureSnapshot } from "@/lib/detectionUtils";

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(
    null,
  );
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingTime(0);
    } else {
      setIsRecording(true);
    }
  };

  // Integration Handlers
  const handleObjectSelect = (obj: DetectedObject, video: HTMLVideoElement) => {
    if (isRecording) return; // Prevent selection while recording

    setSelectedObject(obj);
    setIsCameraActive(false); // Pause detection while modal is open

    const snap = captureSnapshot(video, obj.bbox);
    setSnapshotUrl(snap);
  };

  const handleSaveItem = (
    itemData: Omit<RegisteredItem, "id" | "createdAt">,
  ) => {
    const newItem: RegisteredItem = {
      ...itemData,
      id: `item-${Date.now()}`,
      createdAt: Date.now(),
    };

    try {
      const existingItems = JSON.parse(
        localStorage.getItem("registered_items") || "[]",
      );
      localStorage.setItem(
        "registered_items",
        JSON.stringify([newItem, ...existingItems]),
      );
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }

    // Reset state after saving
    setSelectedObject(null);
    setSnapshotUrl(null);
    setIsCameraActive(true);
  };

  const handleCloseModal = () => {
    setSelectedObject(null);
    setSnapshotUrl(null);
    setIsCameraActive(true);
  };

  return (
    <div className="flex-1 flex-col h-full relative">
      <div className="relative flex-1 bg-black overflow-hidden">
        {/* Abstracted Camera and Detection Layer */}
        <CameraView
          onObjectSelect={handleObjectSelect}
          selectedObjectId={selectedObject?.id}
          isActive={isCameraActive}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        {/* Top Bar (Pointer events are managed so clicks pass through to CameraView's bounding boxes) */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col space-y-2 pointer-events-auto">
            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
              <div
                className={`w-2 h-2 rounded-full ${isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
              />
              <span className="text-white text-xs font-medium tracking-wide uppercase">
                {isCameraActive ? "AI Active" : "Standby"}
              </span>
            </div>

            {isRecording && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center space-x-2 shadow-lg w-fit"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="font-mono text-xs font-medium tracking-wider">
                  {formatTime(recordingTime)}
                </span>
              </motion.div>
            )}
          </div>

          <button className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors pointer-events-auto">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-8 pointer-events-none">
          <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors pointer-events-auto">
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all pointer-events-auto ${
              isRecording
                ? "border-red-500 bg-red-500/20"
                : "border-white bg-white/20"
            }`}
          >
            {isRecording ? (
              <StopCircle className="w-8 h-8 text-red-500 fill-red-500" />
            ) : (
              <div className="w-14 h-14 bg-white rounded-full" />
            )}
          </button>

          <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors pointer-events-auto">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Abstracted Item Modal */}
      {selectedObject && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <ItemModal
            object={selectedObject}
            snapshotUrl={snapshotUrl}
            onClose={handleCloseModal}
            onSave={handleSaveItem}
          />
        </div>
      )}
    </div>
  );
}
