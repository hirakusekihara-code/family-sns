// TT_MOCK=1 のときに使うサンプルデータ（TikTok に接続せず画面を確認するため）
import type { Profile, Video, VideoPage } from "./types";

const svg = (a: string, b: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="270" height="420" fill="url(#g)"/><text x="135" y="215" font-family="sans-serif" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  )}`;

export function mockProfile(username: string): Profile {
  return {
    id: "6800000000000000000",
    username,
    nickname: `サンプル ${username}`,
    avatar: svg("#fe2c55", "#25f4ee", "●"),
    bio: "これはサンプルデータです。\nTT_MOCK を外すと実際のTikTokから取得します。",
    verified: true,
    isPrivate: username.includes("private"),
    region: "JP",
    followers: 1_234_567,
    following: 321,
    likes: 45_678_901,
    videoCount: 60,
    source: "mock",
  };
}

const TAGS = ["#fyp", "#料理", "#vlog", "#猫", "#travel", "#dance"];

export function mockVideos(username: string, cursor: string): VideoPage {
  const start = Number(cursor) || 0;
  const now = Math.floor(Date.now() / 1000);
  const videos: Video[] = Array.from({ length: 12 }, (_, k) => {
    const i = start + k;
    const views = Math.round(20_000 + ((i * 7919) % 97) * 9_000 + (i % 5 === 0 ? 800_000 : 0));
    return {
      id: `73000000000000${String(i).padStart(5, "0")}`,
      author: username,
      title: `サンプル動画 ${i + 1} ${TAGS[i % TAGS.length]} ${TAGS[(i * 3 + 1) % TAGS.length]}`,
      cover: svg(i % 2 ? "#25f4ee" : "#fe2c55", "#161823", `#${i + 1}`),
      duration: 8 + (i % 50),
      createdAt: now - i * 86_400 * 2 - (i % 7) * 3_600 * 3,
      views,
      likes: Math.round(views * (0.04 + (i % 4) * 0.01)),
      comments: Math.round(views * 0.002),
      shares: Math.round(views * 0.001),
      saves: Math.round(views * 0.003),
      pinned: i === 0,
      isPhoto: i % 9 === 4,
      imageCount: i % 9 === 4 ? 3 : 0,
      music: "オリジナル楽曲 - " + username,
    };
  });
  const next = start + videos.length;
  return { videos, cursor: String(next), hasMore: next < 60 };
}
