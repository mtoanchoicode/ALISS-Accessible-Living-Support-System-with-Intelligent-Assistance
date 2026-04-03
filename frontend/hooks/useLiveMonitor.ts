// frontend/hooks/useLiveMonitor.ts
import { useState, useEffect, useCallback } from "react";

export function useLiveMonitor() {
    const [isConnected, setIsConnected] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // 1. Live Clock Effect
    // Updates the time every second for the REC timestamp overlay
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Cleanup the interval when the component unmounts
        return () => clearInterval(timer);
    }, []);

    // 2. Simulated Connection Retry
    // Simulates a network delay when the user clicks "Retry Connection"
    const handleRetryConnection = useCallback(() => {
        setIsConnected(false); // Force UI into the disconnected loading state

        // Pretend to reach out to the CCTV API...
        setTimeout(() => {
            setIsConnected(true); // Re-establish connection after 1.5 seconds
        }, 1500);
    }, []);

    return {
        isConnected,
        currentTime,
        handleRetryConnection,
    };
}