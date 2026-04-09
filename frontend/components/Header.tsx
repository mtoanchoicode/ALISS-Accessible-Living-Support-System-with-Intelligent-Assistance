"use client";

import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";
// import { useAuth } from "@/hooks/useAuth"; // Not currently used, can comment out
import { useUserProfile } from "@/hooks/useUserProfile";
import { Skeleton } from "@/components/ui/Skeleton";
import Image from "next/image";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const { profile, initials, isLoading } = useUserProfile();

  if (
    pathname !== "/"
  ) {
    return null;
  }

  // const getTitle = () => {
  //   switch (pathname) {
  //     case "/":
  //       return "Home";
  //     default:
  //       return "ALISS";
  //   }
  // };

  return (
    <header className="shrink-0 z-50 bg-background/80 backdrop-blur-md border-b border-surface px-4 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-body tracking-tight">
        {profile?.first_name}
      </h1>

      {pathname === "/" && (
        <button
          onClick={() => router.push("/profile")}
          className="relative w-10 h-10 bg-surface rounded-full flex items-center justify-center text-primary hover:shadow-md active:scale-95 transition-all overflow-hidden border border-slate-100"
        >
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-full" />
          ) : profile?.image_uri ? (
            <Image
              src={profile.image_uri}
              alt={`${profile.first_name || "User"}'s avatar`}
              fill
              sizes="40px"
              className="object-cover rounded-full"
              onLoadingComplete={(img) => img.classList.remove("opacity-0")}
            />
          ) : initials ? (
            <span className="font-bold text-sm">{initials}</span>
          ) : (
            <User className="w-5 h-5" />
          )}
        </button>
      )}
    </header>
  );
}
