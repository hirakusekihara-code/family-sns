import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family SNS",
  description: "家族専用のSNSアプリ（プロトタイプ）",
};

// スマートフォンで見やすくするための設定
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-200">
        {/* スマホ幅（最大 448px）の枠。PCで開いても中央にスマホ風に表示されます */}
        <div className="relative mx-auto min-h-screen max-w-md bg-slate-50 pb-20 shadow-xl">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
