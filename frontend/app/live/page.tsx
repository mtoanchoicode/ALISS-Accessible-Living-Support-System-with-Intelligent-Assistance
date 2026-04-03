"use client";

import { motion } from "motion/react";
import {
    Video,
    Wifi,
    WifiOff,
    Maximize2,
    Settings2,
    RefreshCw,
    Clock,
    Activity,
    ShieldCheck
} from "lucide-react";
import { useLiveMonitor } from "@/hooks/useLiveMonitor";

export default function LivePage() {
    const { isConnected, currentTime, handleRetryConnection } = useLiveMonitor();

    // TODO: Integrate CCTV API here
    // const fetchCCTVStream = async () => {
    //   const response = await fetch('https://your-cctv-api.com/stream');
    //   ...
    // };

    return (
        <div className="flex flex-col h-full bg-slate-900 relative">
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
                {/* Simulated CCTV Feed */}
                {isConnected ? (
                    <div className="absolute inset-0">
                        <img
                            src="https://picsum.photos/seed/livingroom/1280/720"
                            alt="CCTV Feed"
                            className="w-full h-full object-cover opacity-80"
                        />
                        {/* Scanline effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] pointer-events-none" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 space-y-4">
                        <WifiOff className="w-16 h-16 animate-pulse" />
                        <p className="text-lg font-medium">Connection Lost</p>
                        <button
                            onClick={handleRetryConnection}
                            className="px-6 py-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"
                        >
                            Retry Connection
                        </button>
                    </div>
                )}

                {/* HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-white text-[10px] font-bold tracking-widest uppercase">REC</span>
                                <span className="text-white/60 text-[10px] font-mono">
                                    {currentTime.toLocaleTimeString([], { hour12: false })}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                <Activity className="w-3 h-3 text-emerald-400" />
                                <span className="text-white text-[10px] font-bold tracking-widest uppercase">CAM 01 - LIVING</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end space-y-2 pointer-events-auto">
                            <button className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/10">
                                <Settings2 className="w-5 h-5" />
                            </button>
                            <button className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/10">
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 max-w-[200px]">
                            <div className="flex items-center space-x-2 mb-1">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span className="text-white text-xs font-bold uppercase tracking-wider">Secure Feed</span>
                            </div>
                            <p className="text-[10px] text-white/60 leading-relaxed">
                                End-to-end encrypted stream from Home Gateway.
                            </p>
                        </div>

                        <button className="p-3 bg-white text-black rounded-full shadow-xl hover:bg-slate-100 transition-colors pointer-events-auto">
                            <Maximize2 className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Corner Brackets */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/40 pointer-events-none" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/40 pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/40 pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/40 pointer-events-none" />
            </div>
        </div>
    );
}
