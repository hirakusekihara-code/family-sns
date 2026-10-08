// 読み込んだ動画からアカウントの傾向を計算する（ブラウザで実行、副作用なし）
import type { Profile, Video } from "./types";

export type Research = {
  count: number;
  totalViews: number;
  avgViews: number;
  medianViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  engagementRate: number; // (いいね+コメント+シェア+保存) ÷ 再生数
  viewsPerFollower: number; // 平均再生数 ÷ フォロワー数
  postsPerWeek: number;
  avgDuration: number;
  firstPost: number;
  lastPost: number;
  weekday: number[]; // 0=日曜 … 6=土曜 の投稿数
  hours: number[]; // 0〜23時の投稿数
  hashtags: { tag: string; count: number; avgViews: number }[];
  top: Video[];
};

export const engagementOf = (v: Video): number =>
  v.views > 0 ? (v.likes + v.comments + v.shares + v.saves) / v.views : 0;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function extractHashtags(title: string): string[] {
  return (title.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase());
}

export function research(videos: Video[], profile: Profile | null): Research {
  const n = videos.length;
  const sum = (f: (v: Video) => number) => videos.reduce((a, v) => a + f(v), 0);
  const totalViews = sum((v) => v.views);
  const interactions = sum((v) => v.likes + v.comments + v.shares + v.saves);
  const avgViews = n ? totalViews / n : 0;

  const times = videos.map((v) => v.createdAt).filter((t) => t > 0);
  const firstPost = times.length ? Math.min(...times) : 0;
  const lastPost = times.length ? Math.max(...times) : 0;
  const weeks = (lastPost - firstPost) / (7 * 24 * 3600);
  const postsPerWeek = times.length > 1 && weeks > 0 ? times.length / weeks : 0;

  const weekday = Array(7).fill(0) as number[];
  const hours = Array(24).fill(0) as number[];
  for (const t of times) {
    const d = new Date(t * 1000);
    weekday[d.getDay()]++;
    hours[d.getHours()]++;
  }

  const tagMap = new Map<string, { count: number; views: number }>();
  for (const v of videos) {
    for (const tag of new Set(extractHashtags(v.title))) {
      const cur = tagMap.get(tag) ?? { count: 0, views: 0 };
      cur.count++;
      cur.views += v.views;
      tagMap.set(tag, cur);
    }
  }
  const hashtags = [...tagMap.entries()]
    .map(([tag, { count, views }]) => ({ tag, count, avgViews: views / count }))
    .sort((a, b) => b.count - a.count || b.avgViews - a.avgViews)
    .slice(0, 15);

  return {
    count: n,
    totalViews,
    avgViews,
    medianViews: median(videos.map((v) => v.views)),
    avgLikes: n ? sum((v) => v.likes) / n : 0,
    avgComments: n ? sum((v) => v.comments) / n : 0,
    avgShares: n ? sum((v) => v.shares) / n : 0,
    engagementRate: totalViews ? interactions / totalViews : 0,
    viewsPerFollower: profile?.followers ? avgViews / profile.followers : 0,
    postsPerWeek,
    avgDuration: n ? sum((v) => v.duration) / n : 0,
    firstPost,
    lastPost,
    weekday,
    hours,
    hashtags,
    top: [...videos].sort((a, b) => b.views - a.views).slice(0, 5),
  };
}

export type SortKey = "newest" | "oldest" | "views" | "likes" | "comments" | "shares" | "engagement";

export function sortVideos(videos: Video[], key: SortKey): Video[] {
  const s = [...videos];
  const by: Record<SortKey, (a: Video, b: Video) => number> = {
    newest: (a, b) => b.createdAt - a.createdAt,
    oldest: (a, b) => a.createdAt - b.createdAt,
    views: (a, b) => b.views - a.views,
    likes: (a, b) => b.likes - a.likes,
    comments: (a, b) => b.comments - a.comments,
    shares: (a, b) => b.shares - a.shares,
    engagement: (a, b) => engagementOf(b) - engagementOf(a),
  };
  return s.sort(by[key]);
}

// Excel で文字化けしないよう BOM 付きの CSV を作る
export function toCsv(videos: Video[]): string {
  const head = ["動画ID", "投稿日時", "タイトル", "再生数", "いいね", "コメント", "シェア", "保存", "エンゲージメント率(%)", "長さ(秒)", "種類", "URL"];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = videos.map((v) => [
    v.id,
    v.createdAt ? new Date(v.createdAt * 1000).toISOString() : "",
    v.title,
    v.views,
    v.likes,
    v.comments,
    v.shares,
    v.saves,
    (engagementOf(v) * 100).toFixed(2),
    v.duration,
    v.isPhoto ? "写真" : "動画",
    `https://www.tiktok.com/@${v.author}/video/${v.id}`,
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}億`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}万`;
  return Math.round(n).toLocaleString("ja-JP");
}

export function percent(r: number, digits = 2): string {
  return `${(r * 100).toFixed(digits)}%`;
}
