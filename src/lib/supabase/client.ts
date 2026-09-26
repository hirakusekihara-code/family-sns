"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// ブラウザで使う Supabase の接続（ログイン状態はブラウザに保存され、自動で更新されます）
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

// テーブルがまだ無い（追加の SQL を実行していない）ときは、画面に分かりやすい案内を出す
export const SETUP_NEEDED = "__setup_needed__";
export function describeDbError(error: { code?: string; message: string }) {
  return error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message) ? SETUP_NEEDED : error.message;
}

// リアルタイム更新が届かない環境の保険：アプリに戻ったとき・一定時間ごとに読み込み直す
export function refreshPeriodically(reload: () => void, intervalMs: number) {
  const id = setInterval(() => {
    if (document.visibilityState === "visible") reload();
  }, intervalMs);
  const onVisible = () => {
    if (document.visibilityState === "visible") reload();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
