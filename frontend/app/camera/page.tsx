"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  StopCircle,
  ArrowLeft,
} from "lucide-react";
import CameraView from "../../components/CameraView";
import ItemModal from "@/components/ItemModal";
import { useCamera } from "@/hooks/useCamera";

export default function RecordPage() {
  const router = useRouter();

  const {
    isRecording,
    recordingTime,
    toggleRecording,
    facingMode,
    isCameraActive,
    toggleCameraActive,
    selectedObject,
    snapshotUrl,
    handleObjectSelect,
    handleSaveItem,
    handleCloseModal,
    webcamRef,
    isModelLoaded,
    objects,
    videoDimensions,
    error,
    handleUserMedia,
    handleUserMediaError,
    selectedRoom,
    setSelectedRoom,
  } = useCamera();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex-col h-[100dvh] w-full relative overflow-hidden bg-black">
      <div className="relative flex-1 bg-black overflow-hidden h-full">
        <CameraView
          webcamRef={webcamRef}
          isModelLoaded={isModelLoaded}
          objects={objects}
          videoDimensions={videoDimensions}
          error={error}
          handleUserMedia={handleUserMedia}
          handleUserMediaError={handleUserMediaError}
          onObjectSelect={handleObjectSelect}
          selectedObjectId={selectedObject?.id}
          isActive={isCameraActive}
          facingMode={facingMode}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

        <div className="absolute top-0 w-full px-4 pt-12 pb-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-50">
          <div className="flex justify-between items-start lg:items-center pointer-events-auto">
            <div className="flex items-start space-x-3">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all shadow-lg border border-white/10 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex flex-col space-y-2">
                <button
                  onClick={toggleCameraActive}
                  className={`flex items-center space-x-2 px-4 h-10 rounded-full backdrop-blur-xl transition-all shadow-lg border ${
                    isCameraActive
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-50"
                      : "bg-white/10 border-white/10 text-white"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                      isCameraActive
                        ? "bg-emerald-400 animate-pulse shadow-emerald-400"
                        : "bg-slate-400"
                    }`}
                  />
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {isCameraActive ? "AI Active" : "Standby"}
                  </span>
                </button>

                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/20 border border-red-500/30 backdrop-blur-xl text-red-50 px-4 h-10 rounded-full flex items-center space-x-2 shadow-lg"
                  >
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                    <span className="font-mono text-xs font-semibold tracking-wider">
                      {formatTime(recordingTime)}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex items-start lg:items-center space-x-2">
              <div className="relative group">
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="appearance-none bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white text-xs font-semibold px-4 h-10 pr-8 rounded-full outline-none border border-white/10 shadow-lg transition-all cursor-pointer"
                >
                  <option value="Living Room" className="text-black">
                    Living Room
                  </option>
                  <option value="Kitchen" className="text-black">
                    Kitchen
                  </option>
                  <option value="Bedroom" className="text-black">
                    Bedroom
                  </option>
                  <option value="Bathroom" className="text-black">
                    Bathroom
                  </option>
                  <option value="Hallway" className="text-black">
                    Hallway
                  </option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/70">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center space-x-8 pointer-events-none z-20">
          <button
            onClick={toggleRecording}
            className={`w-18 h-18 rounded-full border-3 flex items-center justify-center transition-all pointer-events-auto ${
              isRecording
                ? "border-red-500 bg-red-500/20"
                : "border-white bg-white/20"
            }`}
          >
            {isRecording ? (
              <StopCircle className="w-10 h-10 text-red-500 fill-red-500" />
            ) : (
              <div className="w-14 h-14 bg-white rounded-full" />
            )}
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
            defaultLocation={selectedRoom}
          />
        </div>
      )}
    </div>
  );
}
