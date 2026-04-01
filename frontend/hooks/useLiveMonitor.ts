import { useState, useEffect } from "react";

export function useLiveMonitor() {
  const [isConnected, setIsConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRetryConnection = () => {
    setIsConnected(true);
  };

  return {
    isConnected,
    currentTime,
    handleRetryConnection,
  };
}
