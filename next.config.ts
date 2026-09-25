import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中に表示される「N」ボタンがボトムナビと重ならないよう右上に移動
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
