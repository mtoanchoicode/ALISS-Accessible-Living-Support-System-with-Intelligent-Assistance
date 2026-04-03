"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { AvatarSection } from "./components/AvatarSection";
import { ProfileForm } from "./components/ProfileForm";

export default function EditProfilePage() {
  const router = useRouter();
  const { 
    profile, isLoading, initials,
    firstName, setFirstName,
    lastName, setLastName,
    avatarPreview,
    isSaving, handleImageChange, handleSave
  } = useUserProfile();

  return (
    <div className="min-h-screen bg-white flex flex-col pt-safe pb-safe">
      <header className="px-4 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10 bg-white">
        <button 
          onClick={() => router.back()} 
          className="p-2 hover:bg-slate-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>
        <h1 className="text-lg font-bold text-slate-900 ">Edit Profile</h1>
        <div className="w-10" /> 
      </header>

      <div className="flex-grow overflow-y-auto px-6 py-8 space-y-10">
        <AvatarSection 
          isLoading={isLoading} 
          avatarPreview={avatarPreview} 
          initials={initials} 
          onImageChange={handleImageChange} 
        />
        
        <ProfileForm 
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          profile={profile}
        />
      </div>

      {/* Fixed Bottom Footer with Slide-up Animation */}
      <div className="p-4 mt-auto border-t border-slate-100 bg-white">
        <motion.button 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="w-full bg-[#3F62C7] text-white font-bold rounded-full py-4 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            "Save Changes"
          )}
        </motion.button>
      </div>
    </div>
  );
}