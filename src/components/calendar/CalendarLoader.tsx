"use client";

import dynamic from "next/dynamic";

// カレンダーは「今日の日付」を使うので、ブラウザ側だけで表示します
// （サーバーで作ったHTMLと日付がずれるのを防ぐため）
const CalendarApp = dynamic(() => import("./CalendarApp"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-slate-400">カレンダーを読み込み中…</p>,
});

export default function CalendarLoader() {
  return <CalendarApp />;
}
