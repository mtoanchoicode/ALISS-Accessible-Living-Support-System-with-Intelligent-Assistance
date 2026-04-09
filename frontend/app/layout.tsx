import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import "flag-icons/css/flag-icons.min.css";
import QueryProvider from "@/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ALISS",
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
        className="bg-surface text-body font-sans antialiased"
        suppressHydrationWarning
      >
        <QueryProvider>
          <div className="mx-auto max-w-[430px] bg-background h-[100dvh] shadow-2xl relative overflow-hidden flex flex-col">
            {/* <Header /> */}
            <main className="flex-1 overflow-y-auto flex flex-col">{children}</main>
            <BottomNav />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
