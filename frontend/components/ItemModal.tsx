import React, { useState, useEffect } from "react";
import { ItemModalProps } from "@/types/detection";
import { X, Save, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ItemModal({
  object,
  snapshotUrl,
  onClose,
  onSave,
  defaultLocation,
}: ItemModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (object) {
      setName(object.class.charAt(0).toUpperCase() + object.class.slice(1));
      setLocation(defaultLocation || "Living Room");
    }
  }, [object, defaultLocation]);

  if (!object) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 2. Just pass name and location!
      await onSave({
        name: name,
        location: location,
      });
    } catch (error) {
      console.error("Error saving:", error);
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`
      absolute z-50 text-body flex flex-col transition-all duration-300
      ${
        isMobile
          ? "bottom-4 left-4 right-4 w-auto rounded-3xl pb-2 shadow-2xl"
          : "top-4 right-4 w-80 rounded-3xl border"
      }
      bg-surface/95 backdrop-blur-xl border border-surface shadow-2xl overflow-hidden
      max-h-[90dvh]
    `}
    >
      <div className="flex items-center justify-between p-4 border-b border-background bg-background/40">
        <h3 className="font-medium tracking-tight">Register Item</h3>
        <button
          onClick={onClose}
          disabled={isSaving}
          className="p-2 hover:bg-background rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex flex-col md:block gap-6">
          {snapshotUrl && (
            <div className="mb-4 md:mb-4 rounded-xl overflow-hidden border border-surface bg-background/40 aspect-video flex items-center justify-center shrink-0">
              <img
                src={snapshotUrl}
                alt="Snapshot"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-6 text-sm">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20 font-medium tracking-tight shadow-sm">
                {object.class}
              </span>
            </div>

            <form
              id="register-form"
              onSubmit={handleSave}
              className="space-y-5"
            >
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background/50 border border-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted/60"
                  placeholder="E.g., My Coffee Mug"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-background/50 border border-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted/60"
                  placeholder="E.g., Living Room, Kitchen"
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-4 pb-4 border-t border-background bg-background/20">
        <button
          type="submit"
          form="register-form"
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] ${
            isSaving
              ? "bg-surface text-muted cursor-not-allowed"
              : "bg-primary hover:brightness-110 text-white shadow-primary/20"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Processing Memory...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" /> Save Item
            </>
          )}
        </button>
      </div>
    </div>
  );
}
