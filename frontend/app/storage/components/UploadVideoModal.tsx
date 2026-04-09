import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, UploadCloud, FileVideo } from "lucide-react";

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (name: string, file: File, location?: string) => Promise<void>;
}

export function UploadVideoModal({ isOpen, onClose, onUpload }: UploadVideoModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setLocation("");
      setSelectedFile(null);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill name if empty
      if (!name) {
        // Strip extension
        setName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedFile) return;
    
    try {
      setIsUploading(true);
      await onUpload(name.trim(), selectedFile, location.trim() || undefined);
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-surface rounded-3xl p-6 shadow-2xl border border-background z-50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-body">Upload Video</h3>
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-body hover:bg-background rounded-full transition-colors outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* File Drop/Select Area */}
              <div 
                className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all ${
                  selectedFile 
                    ? "border-primary bg-primary/5" 
                    : "border-background bg-background hover:bg-surface hover:border-primary/30 cursor-pointer"
                }`}
                onClick={() => !selectedFile && fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-surface rounded-full shadow-sm flex items-center justify-center text-primary">
                      <FileVideo className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-body line-clamp-1 max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs font-semibold text-muted mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setName("");
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-600 mt-2 p-2"
                    >
                      Remove Video
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-3 pointer-events-none">
                    <div className="w-12 h-12 bg-surface rounded-full shadow-sm flex items-center justify-center text-muted">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-body">Tap to select video</p>
                      <p className="text-xs font-medium text-muted mt-1">MP4, WebM, MOV</p>
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="video/*"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted ml-1">Video Title</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a descriptive title"
                  className="w-full bg-background border border-surface px-4 py-3 text-body font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all rounded-xl placeholder-muted"
                />
              </div>

              {/* Location Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted ml-1">Location (Optional)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="E.g., Living Room, Kitchen"
                  className="w-full bg-background border border-surface px-4 py-3 text-body font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all rounded-xl placeholder-muted"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !name.trim() || !selectedFile}
                className="w-full flex items-center justify-center py-3.5 bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:brightness-100 shadow-md shadow-primary/20"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Upload Video"
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
