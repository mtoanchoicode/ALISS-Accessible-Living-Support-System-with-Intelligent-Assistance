import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, UploadCloud, FileVideo } from "lucide-react";

interface VideoSlot {
  file: File | null;
  location: string;
}

// Initialize with the backend's expected defaults
const defaultSlots = (): VideoSlot[] => [
  { file: null, location: "Living room" },
  { file: null, location: "Bedroom" },
];

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated signature to match the backend requirement
  onUpload: (
    file_1: File,
    file_2: File,
    location_1?: string,
    location_2?: string,
  ) => Promise<void>;
}

export function UploadVideoModal({
  isOpen,
  onClose,
  onUpload,
}: UploadVideoModalProps) {
  // Enforce exactly 2 slots for the activity processing
  const [slots, setSlots] = useState<VideoSlot[]>(defaultSlots());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null]);

  useEffect(() => {
    if (isOpen) {
      setSlots(defaultSlots());
    }
  }, [isOpen]);

  const updateSlot = (index: number, update: Partial<VideoSlot>) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...update } : s)),
    );
  };

  const handleFileChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      updateSlot(index, { file });
    }
  };

  // Must have exactly both files to run the multi-cam backend logic
  const canSubmit = slots[0].file !== null && slots[1].file !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsUploading(true);
      await onUpload(
        slots[0].file!,
        slots[1].file!,
        slots[0].location.trim() || undefined,
        slots[1].location.trim() || undefined,
      );
      onClose();
    } catch (error) {
      console.error("Failed to upload video:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-surface rounded-3xl p-6 shadow-2xl border border-background z-50 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-body">
                  Activity Processing
                </h3>
                <p className="text-xs text-muted font-semibold mt-1">
                  Upload exactly 2 camera feeds
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-body hover:bg-background rounded-full transition-colors outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {slots.map((slot, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-background rounded-2xl p-4 space-y-3 border border-surface"
                >
                  {/* Slot header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider">
                      Camera Feed {index + 1}
                    </span>
                  </div>

                  {/* File picker */}
                  <div
                    className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-all ${
                      slot.file
                        ? "border-primary bg-primary/5"
                        : "border-surface hover:border-primary/30 cursor-pointer"
                    }`}
                    onClick={() =>
                      !slot.file && fileInputRefs.current[index]?.click()
                    }
                  >
                    {slot.file ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 bg-surface rounded-full shadow-sm flex items-center justify-center text-primary shrink-0">
                            <FileVideo className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-body truncate">
                              {slot.file.name}
                            </p>
                            <p className="text-xs font-semibold text-muted">
                              {(slot.file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        {/* Allow replacing the file */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRefs.current[index]?.click();
                          }}
                          className="text-xs font-bold text-primary hover:underline ml-2"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-2 pointer-events-none py-2">
                        <UploadCloud className="w-6 h-6 text-muted" />
                        <p className="text-xs font-bold text-muted">
                          Tap to select video
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      ref={(el) => {
                        fileInputRefs.current[index] = el;
                      }}
                      onChange={(e) => handleFileChange(index, e)}
                    />
                  </div>

                  {/* Location */}
                  <input
                    type="text"
                    value={slot.location}
                    onChange={(e) =>
                      updateSlot(index, { location: e.target.value })
                    }
                    placeholder={`Location (e.g. ${index === 0 ? "Living Room" : "Bedroom"})`}
                    className="w-full bg-surface border border-surface px-3.5 py-2.5 text-sm text-body font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all rounded-xl placeholder-muted"
                  />
                </motion.div>
              ))}

              <button
                type="submit"
                disabled={isUploading || !canSubmit}
                className="w-full flex items-center justify-center py-3.5 bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:brightness-100 shadow-md shadow-primary/20"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Process Activity Videos"
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
