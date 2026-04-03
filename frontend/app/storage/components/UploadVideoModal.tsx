import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, UploadCloud, FileVideo } from "lucide-react";

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (name: string, file: File) => Promise<void>;
}

export function UploadVideoModal({ isOpen, onClose, onUpload }: UploadVideoModalProps) {
  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
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
      await onUpload(name.trim(), selectedFile);
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl z-50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Upload Video</h3>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* File Drop/Select Area */}
              <div 
                className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all ${
                  selectedFile 
                    ? "border-[#3F62C7] bg-[#eff6ff]" 
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 cursor-pointer"
                }`}
                onClick={() => !selectedFile && fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-[#3F62C7]">
                      <FileVideo className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">
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
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Tap to select video</p>
                      <p className="text-xs font-medium text-slate-400 mt-1">MP4, WebM, MOV</p>
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
                <label className="text-sm font-bold text-slate-600 ml-1">Video Title</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a descriptive title"
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3F62C7] focus:border-transparent transition-all rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !name.trim() || !selectedFile}
                className="w-full flex items-center justify-center py-3.5 bg-[#3F62C7] text-white rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70"
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
