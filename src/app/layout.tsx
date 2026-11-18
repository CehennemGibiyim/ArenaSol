import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: "Arena Live OS — TikTok LIVE Ajans Paneli",
  description:
    "TikTok LIVE ajansları için canlı stüdyo, radar, chat botu, overlay kütüphanesi, gelir muhasebesi ve Windows kurulum paketi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
