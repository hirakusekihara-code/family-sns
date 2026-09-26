// Supabase の接続先
// Project URL と Publishable key は「アプリに組み込んで公開する前提」の値なので、コードに書いて大丈夫です。
// （データは Supabase 側の安全設定で「同じ家族しか見られない」ように守られています）
// ※ Secret key は絶対にここに書かず、Vercel の環境変数 SUPABASE_SECRET_KEY に入れます。
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ikhjnzxwehdhdqgznjaf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ptlNrBgGcrzvzYe3BZ-_5Q_VlTH-ojL";
