import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Global styles
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MemoryMap Home",
  description: "AI-powered home mapping and object tracking assistant.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className="bg-slate-100 text-slate-900 font-sans antialiased"
        suppressHydrationWarning
      >
        <div className="mx-auto max-w-md bg-white min-h-[100dvh] shadow-2xl relative overflow-hidden flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto pb-16 flex flex-col">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
