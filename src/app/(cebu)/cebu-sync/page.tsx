"use client";

import dynamic from "next/dynamic";

// 現在時刻やモックデータを初期表示に使うため、サーバーで事前描画せずブラウザだけで描画する
const CebuSyncApp = dynamic(() => import("@/components/cebu-sync/CebuSync"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm text-slate-500">Cebu Sync を読み込み中…</div>,
});

export default function CebuSyncPage() {
  return <CebuSyncApp />;
}
