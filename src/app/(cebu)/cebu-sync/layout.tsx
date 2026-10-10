import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "../../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cebu Sync",
  description: "セブオフィス遠隔マネジメント（Phase 1 プロトタイプ・モックデータ）",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

// Family SNS とは別のルートレイアウト（スマホ枠・ログイン画面なしの全幅表示）
export default function CebuSyncLayout({ children }: LayoutProps<"/cebu-sync">) {
  return (
    <html lang="ja" className={`${geistSans.variable} antialiased`}>
      <body className="min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
