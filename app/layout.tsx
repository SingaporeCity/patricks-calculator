import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { isDemoMode } from "@/lib/data";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Patricks Calculator",
  description: "Royalty-berekening: contracten, staffels, voorschotten en uitbetaling per auteur.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={inter.variable}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar demoMode={isDemoMode} />
          <main className="print-full flex-1 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
