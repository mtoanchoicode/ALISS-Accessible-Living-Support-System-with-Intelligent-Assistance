import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-[#E5E7EB] via-[#F3F4F6] to-[#E5E7EB] bg-[length:400%_100%] rounded ${className}`}
      {...props}
    />
  );
}
