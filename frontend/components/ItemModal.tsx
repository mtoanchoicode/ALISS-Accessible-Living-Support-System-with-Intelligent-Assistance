import React, { useState, useEffect } from 'react';
import { DetectedObject, RegisteredItem } from '@/types/detection';
import { X, Save } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ItemModalProps {
  object: DetectedObject | null;
  snapshotUrl: string | null;
  onClose: () => void;
  onSave: (item: Omit<RegisteredItem, 'id' | 'createdAt'>) => void;
}

export default function ItemModal({ object, snapshotUrl, onClose, onSave }: ItemModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (object) {
      setName(object.class.charAt(0).toUpperCase() + object.class.slice(1));
      setCategory('General');
    }
  }, [object]);

  if (!object) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      category,
      label: object.class,
      confidence: object.score,
      snapshotUrl: snapshotUrl || '',
    });
  };

  return (
    <div className={`
      absolute z-50 text-zinc-100 flex flex-col transition-all duration-300
      ${isMobile 
        ? 'bottom-0 left-0 right-0 w-full rounded-t-3xl border-t pb-safe' 
        : 'top-4 right-4 w-80 rounded-2xl border'}
      bg-zinc-900/95 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden
      max-h-[90dvh]
    `}>
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
        <h3 className="font-medium tracking-tight">Register Item</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex flex-col md:block gap-6">
          {snapshotUrl && (
            <div className="mb-4 md:mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center shrink-0">
              <img src={snapshotUrl} alt="Snapshot" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-6 text-sm">
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30 font-medium">
                {object.class}
              </span>
              <span className="text-zinc-400">
                {Math.round(object.score * 100)}% confidence
              </span>
            </div>

            <form id="register-form" onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  // Changed text-sm to text-base (16px) to prevent iOS auto-zoom on focus
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                  placeholder="E.g., My Coffee Mug"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  // Changed text-sm to text-base here too
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                  placeholder="E.g., Electronics, Kitchen"
                />
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Added extra padding bottom (pb-8) for mobile safe areas and home bar */}
      <div className="p-4 md:p-4 pb-8 md:pb-4 border-t border-white/10 bg-black/40">
        <button
          type="submit"
          form="register-form"
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-semibold transition-colors shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          Save Item
        </button>
      </div>
    </div>
  );
}