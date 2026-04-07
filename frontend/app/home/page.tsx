"use client";

import {
  Search,
  Map,
  Clock,
  Bell,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function HomePage() {
  // Assuming useUserProfile returns an isLoading boolean
  const { profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-200 rounded-3xl p-5 h-36 animate-pulse"></div>
          <div className="bg-slate-200 rounded-3xl p-5 h-36 animate-pulse"></div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-28 bg-slate-200 rounded animate-pulse px-1"></div>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center p-4 rounded-2xl border border-slate-100 shadow-sm bg-white animate-pulse"
            >
              <div className="w-12 h-12 bg-slate-200 rounded-full mr-4"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-3 w-24 bg-slate-200 rounded"></div>
              </div>
              <div className="w-5 h-5 bg-slate-200 rounded-full"></div>
            </div>
          ))}
        </div>

        {/* Recent Activity Skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse px-1"></div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex items-center p-4 ${i !== 3 ? "border-b border-slate-50" : ""}`}
              >
                <div className="w-10 h-10 bg-slate-200 rounded-full mr-4 shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-slate-200 rounded"></div>
                  <div className="h-3 w-40 bg-slate-200 rounded"></div>
                </div>
                <div className="h-3 w-12 bg-slate-200 rounded ml-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Actual Page Content ---
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Good morning,</h2>
          <p className="text-slate-500">
            {profile ? `${profile.first_name} ${profile.last_name}` : "Guest"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#3F62C7] rounded-3xl p-5 text-white shadow-sm shadow-[#3F62C7]/20 hover:scale-[1.02] transition-transform cursor-pointer">
          <Map className="w-8 h-8 mb-4 opacity-80" />
          <h3 className="text-3xl font-bold mb-1">4</h3>
          <p className="text-[#dbeafe] text-sm font-medium">Rooms Mapped</p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
          <Search className="w-8 h-8 mb-4 text-amber-500" />
          <h3 className="text-3xl font-bold text-slate-900 mb-1">12</h3>
          <p className="text-slate-500 text-sm font-medium">Objects Tracked</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 px-1">Quick Actions</h3>
        <Link
          href="/chat"
          className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Find an Object</h4>
              <p className="text-xs text-slate-500">Ask the AI assistant</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </Link>

        <Link
          href="/camera"
          className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Scan New Area</h4>
              <p className="text-xs text-slate-500">Update home context</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </Link>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 px-1">Recent Activity</h3>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {[
            {
              title: "Keys located",
              desc: "Living Room table",
              time: "10 mins ago",
              icon: ShieldCheck,
              color: "text-emerald-500",
              bg: "bg-emerald-50",
            },
            {
              title: "New scan added",
              desc: "Kitchen area",
              time: "2 hours ago",
              icon: Clock,
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              title: "Glasses moved",
              desc: "From Bedroom to Living Room",
              time: "Yesterday",
              icon: Bell,
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex items-start p-4 ${i !== 2 ? "border-b border-slate-50" : ""}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.bg} ${item.color} mr-4`}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-900 text-sm">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 truncate">{item.desc}</p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
