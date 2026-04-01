"use client";

import React from "react";
import { motion } from "motion/react";
import { StopCircle, RefreshCw, Maximize2, Settings2 } from "lucide-react";
import CameraView from "../../components/CameraView";
import ItemModal from "@/components/ItemModal";
import { useCameraControls } from "@/hooks/useCameraControls";

export default function RecordPage() {
  const {
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
  } = useCameraControls();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    // Changed to h-[100dvh] for mobile browser safe areas
    <div className="flex-1 flex-col h-[100dvh] w-full relative overflow-hidden bg-black">
      <div className="relative flex-1 bg-black overflow-hidden h-full">
        <CameraView
          onObjectSelect={handleObjectSelect}
          selectedObjectId={selectedObject?.id}
          isActive={isCameraActive}
          facingMode={facingMode}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

        <div className="absolute top-safe pt-6 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
          <div className="flex flex-col space-y-2 pointer-events-auto">
            <button 
              onClick={toggleCameraActive}
              className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full hover:bg-black/60 transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full ${isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
              />
              <span className="text-white text-xs font-medium tracking-wide uppercase">
                {isCameraActive ? "AI Active" : "Standby"}
              </span>
            </button>

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

          <button className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors pointer-events-auto">
            <Settings2 className="w-6 h-6" />
          </button>
        </div>

        {/* Adjusted bottom spacing for mobile (pb-10) and larger touch targets */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center space-x-8 pointer-events-none z-20">
          <button 
            onClick={toggleFacingMode}
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors pointer-events-auto"
          >
            <RefreshCw className="w-6 h-6" />
          </button>

          <button
            onClick={toggleRecording}
            className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all pointer-events-auto ${
              isRecording
                ? "border-red-500 bg-red-500/20"
                : "border-white bg-white/20"
            }`}
          >
            {isRecording ? (
              <StopCircle className="w-10 h-10 text-red-500 fill-red-500" />
            ) : (
              <div className="w-16 h-16 bg-white rounded-full" />
            )}
          </button>

          <button 
            onClick={toggleFullScreen}
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors pointer-events-auto"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      {selectedObject && (
        <div className="absolute inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
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