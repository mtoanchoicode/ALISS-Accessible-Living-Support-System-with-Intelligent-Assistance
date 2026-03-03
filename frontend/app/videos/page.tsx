"use client";

import { motion } from "motion/react";
import { Play, Clock, MapPin, MoreVertical } from "lucide-react";
import Image from "next/image";

const MOCK_VIDEOS = [
  {
    id: 1,
    title: "Living Room Scan",
    duration: "02:15",
    date: "Today, 10:30 AM",
    location: "Living Room",
    thumbnail: "https://picsum.photos/seed/livingroom/400/300",
  },
  {
    id: 2,
    title: "Kitchen Overview",
    duration: "01:45",
    date: "Yesterday, 04:15 PM",
    location: "Kitchen",
    thumbnail: "https://picsum.photos/seed/kitchen/400/300",
  },
  {
    id: 3,
    title: "Bedroom Setup",
    duration: "03:20",
    date: "Oct 24, 09:00 AM",
    location: "Bedroom",
    thumbnail: "https://picsum.photos/seed/bedroom/400/300",
  },
  {
    id: 4,
    title: "Hallway Context",
    duration: "00:55",
    date: "Oct 23, 11:45 AM",
    location: "Hallway",
    thumbnail: "https://picsum.photos/seed/hallway/400/300",
  },
];

export default function VideosPage() {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-slate-800">Recent Scans</h2>
        <span className="text-sm text-teal-600 font-medium cursor-pointer">
          Filter
        </span>
      </div>

      <div className="space-y-4">
        {MOCK_VIDEOS.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col"
          >
            <div className="relative aspect-video bg-slate-200">
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-xs font-medium px-2 py-1 rounded-md">
                {video.duration}
              </div>
            </div>

            <div className="p-4 flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-slate-900">{video.title}</h3>
                <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{video.date}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{video.location}</span>
                  </div>
                </div>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
