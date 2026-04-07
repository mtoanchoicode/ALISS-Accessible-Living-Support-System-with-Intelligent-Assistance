"use client";

interface TabsProps {
  tabs: readonly ("items" | "videos")[];
  activeTab: "items" | "videos";
  onTabChange: (tab: "items" | "videos") => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex p-1 bg-slate-100 rounded-2xl">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
            activeTab === tab
              ? "bg-white text-[#3F62C7] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
