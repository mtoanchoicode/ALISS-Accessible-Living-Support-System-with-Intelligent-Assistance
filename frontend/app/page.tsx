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
import { Skeleton } from "@/components/ui/Skeleton";

export default function HomePage() {
  // Assuming useUserProfile returns an isLoading boolean
  const { profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="rounded-3xl p-5 h-36" />
          <Skeleton className="rounded-3xl p-5 h-36" />
        </div>

        {/* Quick Actions Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-28 px-1" />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center p-4 rounded-2xl border border-slate-100 shadow-sm bg-surface"
            >
              <Skeleton className="w-12 h-12 rounded-full mr-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="w-5 h-5 rounded-full" />
            </div>
          ))}
        </div>

        {/* Recent Activity Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 px-1" />
          <div className="bg-surface rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex items-center p-4 ${i !== 3 ? "border-b border-slate-50" : ""}`}
              >
                <Skeleton className="w-10 h-10 rounded-full mr-4 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-3 w-12 ml-2" />
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
      {/* <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Good morning,</h2>
          <p className="text-slate-500">
            {profile ? `${profile.first_name} ${profile.last_name}` : "Guest"}
          </p>
        </div>
      </div> */}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-primary rounded-3xl p-5 text-white shadow-sm shadow-primary/20 active:scale-95 hover:shadow-md transition-all duration-200 cursor-pointer">
          <Map className="w-8 h-8 mb-4 opacity-80" />
          <h3 className="text-3xl font-bold mb-1">4</h3>
          <p className="text-white/80 text-sm font-medium">Rooms Mapped</p>
        </div>
        <div className="bg-surface rounded-3xl p-5 border border-slate-100 shadow-sm active:scale-95 hover:shadow-md transition-all duration-200 cursor-pointer">
          <Search className="w-8 h-8 mb-4 text-warning" />
          <h3 className="text-3xl font-bold text-body mb-1">12</h3>
          <p className="text-muted text-sm font-medium">Objects Tracked</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-body px-1">Quick Actions</h3>
        <Link
          href="/chat"
          className="flex items-center justify-between bg-surface p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-azure shadow-sm">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-body">Find an Object</h4>
              <p className="text-xs text-muted">Ask the AI assistant</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted" />
        </Link>

        <Link
          href="/camera"
          className="flex items-center justify-between bg-surface p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-success shadow-sm">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-body">Scan New Area</h4>
              <p className="text-xs text-muted">Update home context</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted" />
        </Link>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-body px-1">Recent Activity</h3>
        <div className="bg-surface rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {[
            {
              title: "Keys located",
              desc: "Living Room table",
              time: "10 mins ago",
              icon: ShieldCheck,
              color: "text-success",
              bg: "bg-white",
            },
            {
              title: "New scan added",
              desc: "Kitchen area",
              time: "2 hours ago",
              icon: Clock,
              color: "text-azure",
              bg: "bg-white",
            },
            {
              title: "Glasses moved",
              desc: "From Bedroom to Living Room",
              time: "Yesterday",
              icon: Bell,
              color: "text-warning",
              bg: "bg-white",
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex items-start p-4 ${i !== 2 ? "border-b border-slate-50" : ""}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.bg} ${item.color} shadow-sm mr-4`}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-body text-sm">
                  {item.title}
                </h4>
                <p className="text-xs text-muted truncate">{item.desc}</p>
              </div>
              <span className="text-[10px] text-muted whitespace-nowrap ml-2">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
