"use client";

import dynamic from "next/dynamic";

// マップは「今日の予定」を使うので、ブラウザ側だけで表示します
const MapApp = dynamic(() => import("./MapApp"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-slate-400">…</p>,
});

export default function MapLoader() {
  return <MapApp />;
}
