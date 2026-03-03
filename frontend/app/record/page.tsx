"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Camera,
  StopCircle,
  Video,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Settings2,
} from "lucide-react";

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const videoElement = videoRef.current;
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: true,
        });
        if (videoElement) {
          videoElement.srcObject = stream;
        }
        setHasPermission(true);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setHasPermission(false);
      }
    }

    setupCamera();

    return () => {
      if (videoElement?.srcObject) {
        const tracks = (videoElement.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

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

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      <div className="relative flex-1 bg-black overflow-hidden">
        {hasPermission === false ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-lg font-medium">Camera Access Denied</p>
            <p className="text-sm text-slate-400 mt-2">
              Please enable camera permissions to use the scanner.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                  <div
                    className={`w-2 h-2 rounded-full ${isDetecting ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
                  />
                  <span className="text-white text-xs font-medium tracking-wide uppercase">
                    {isDetecting ? "AI Active" : "Standby"}
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

            {/* Simulated Object Detection Bounding Box */}
            {isDetecting && hasPermission && !isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  repeatType: "reverse",
                }}
                className="absolute top-1/3 left-1/4 w-1/2 h-1/4 border-2 border-emerald-400 rounded-lg bg-emerald-400/10 flex items-start justify-start p-1"
              >
                <span className="bg-emerald-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                  Keys (98%)
                </span>
              </motion.div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-8 pointer-events-auto">
              <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <RefreshCw className="w-5 h-5" />
              </button>

              <button
                onClick={toggleRecording}
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
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

              <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
