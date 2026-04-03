import React, { useRef } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { User, Camera, Loader2 } from "lucide-react";

interface AvatarSectionProps {
  isLoading: boolean;
  avatarPreview: string | null;
  initials: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AvatarSection({ isLoading, avatarPreview, initials, onImageChange }: AvatarSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center"
    >
      <div className="relative group">
        <div className="w-32 h-32 rounded-full bg-[#3F62C7] overflow-hidden flex items-center justify-center relative border border-slate-100">
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin opacity-40 text-white" />
          ) : avatarPreview ? (
            <Image 
              src={avatarPreview} 
              alt="Profile" 
              fill 
              className="object-cover" 
            />
          ) : initials ? (
            <span className="text-4xl font-bold text-white uppercase tracking-tighter">{initials}</span>
          ) : (
            <User className="w-12 h-12 text-white/50" />
          )}
        </div>
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 w-10 h-10 bg-[#3F62C7] text-white rounded-full flex items-center justify-center border-4 border-white active:scale-90 transition-transform"
        >
          <Camera className="w-5 h-5" />
        </button>

        <input 
          type="file" 
          ref={fileInputRef}
          onChange={onImageChange}
          accept="image/*"
          className="hidden"
        />
      </div>
      <button 
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-sm font-bold text-[#3F62C7] mt-4"
      >
        Update Photo
      </button>
    </motion.div>
  );
}
