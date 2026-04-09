import React from "react";
import { motion } from "motion/react";
import { Mail, Phone } from "lucide-react";
import { UserProfile } from "@/types";

interface ProfileFormProps {
  firstName: string;
  setFirstName: (name: string) => void;
  lastName: string;
  setLastName: (name: string) => void;
  profile: UserProfile | null | undefined;
}

export function ProfileForm({ firstName, setFirstName, lastName, setLastName, profile }: ProfileFormProps) {
  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-6"
      >
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 tracking-widest ml-1">First Name</label>
          <input 
            type="text" 
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-slate-100 border-b-2 border-slate-100 px-2 py-3 text-slate-900 font-semibold focus:outline-none focus:border-[#3F62C7] transition-all rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 tracking-widest ml-1">Last Name</label>
          <input 
            type="text" 
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-slate-100 border-b-2 border-slate-100 px-2 py-3 text-slate-900 font-semibold focus:outline-none focus:border-[#3F62C7] transition-all rounded-lg"
          />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="px-1 space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 tracking-widest ml-1">Email Address</label>
          <div className="flex bg-slate-100 rounded-lg justify-center items-center px-4">
            <Mail className="w-5 h-5 text-slate-400" />
            <input 
              type="email" 
              value={profile?.email || ""}
              disabled
              className="w-full bg-slate-100 border-b border-slate-100 pl-4 py-3 text-slate-900 font-semibold cursor-not-allowed rounded-lg"
            />
          </div>
        </div>

        <div className="px-1 space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 tracking-widest ml-1">Phone Number</label>
          <div className="flex bg-slate-100 rounded-lg justify-center items-center px-4">
            <Phone className="w-5 h-5 text-slate-400" />
            <input 
              type="tel" 
              value={profile?.phone || "Not provided"}
              disabled
              className="w-full bg-slate-100 border-b border-slate-100 pl-4 py-3 text-slate-900 font-semibold cursor-not-allowed rounded-lg"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
