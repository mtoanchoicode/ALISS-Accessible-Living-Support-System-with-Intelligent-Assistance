import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2 } from "lucide-react";

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onSave: (newName: string) => Promise<void>;
  type: "item" | "video";
}

export function EditItemModal({ isOpen, onClose, initialName, onSave, type }: EditItemModalProps) {
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === initialName) {
      onClose();
      return;
    }
    
    try {
      setIsSaving(true);
      await onSave(name.trim());
      onClose();
    } catch (error) {
      console.error(`Failed to update ${type}:`, error);
    } finally {
      setIsSaving(false);
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
              <h3 className="text-xl font-bold text-slate-900 capitalize">Edit {type}</h3>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 ml-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Enter new ${type} name`}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3F62C7] focus:border-transparent transition-all rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="w-full flex items-center justify-center py-3.5 bg-[#3F62C7] text-white rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
