import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中に画面の隅に出る「N」ボタンを非表示（ボタンと重なるため）
  // ※ エラーが起きたときの表示は引き続き出ます
  devIndicators: false,
};

export default nextConfig;
