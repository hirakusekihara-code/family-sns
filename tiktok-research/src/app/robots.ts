import type { MetadataRoute } from "next";

// 個人用なので検索エンジンには一切載せない
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
