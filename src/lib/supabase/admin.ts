import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// サーバー（Vercel）だけで使う管理者用の接続。Secret key はブラウザには絶対に送られません。
export function adminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  return createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ログイン処理だけを行う、保存しない一時的な接続
export function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 子どものアカウント用のメールアドレス：保護者のメールに「+ログインID」を付ける
// （例：hiraku.sekihara+hana2015@gmail.com → パスワード再設定のメールは保護者に届きます）
export function kidEmail(parentEmail: string, loginId: string) {
  const [local, domain] = parentEmail.split("@");
  return `${local}+${loginId}@${domain}`;
}
