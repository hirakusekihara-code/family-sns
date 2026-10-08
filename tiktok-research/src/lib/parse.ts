// 入力の読み取りと、外部APIの返事を共通の形に整える処理（サーバー・ブラウザ共用、副作用なし）
import type { Profile, Video } from "./types";

export type ParsedInput =
  | { kind: "user"; username: string }
  | { kind: "video"; url: string; id?: string; username?: string }
  | { kind: "invalid"; reason: string };

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const TIKTOK_HOST_RE = /(^|\.)tiktok\.com$/i;

// 「@name」「name」「tiktok.com/@name」「動画URL」「vm.tiktok.com/xxx の短縮URL」を見分ける
export function parseInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (!text) return { kind: "invalid", reason: "ユーザー名かURLを入力してください" };

  const looksLikeUrl = /^(https?:\/\/)?([a-z0-9-]+\.)*tiktok\.com\//i.test(text);
  if (looksLikeUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return { kind: "invalid", reason: "URLの形式が正しくありません" };
    }
    if (!TIKTOK_HOST_RE.test(url.hostname)) return { kind: "invalid", reason: "TikTokのURLではありません" };

    const video = url.pathname.match(/^\/@([^/]+)\/(?:video|photo)\/(\d+)/);
    if (video) {
      return { kind: "video", url: `https://www.tiktok.com/@${video[1]}/video/${video[2]}`, id: video[2], username: video[1] };
    }
    const user = url.pathname.match(/^\/@([^/?#]+)\/?$/);
    if (user) {
      const username = decodeURIComponent(user[1]);
      return USERNAME_RE.test(username) ? { kind: "user", username } : { kind: "invalid", reason: "ユーザー名に使えない文字が含まれています" };
    }
    // vm.tiktok.com/XXXX や tiktok.com/t/XXXX は短縮URL。サーバー側で展開する
    if (/^(vm|vt)\.tiktok\.com$/i.test(url.hostname) || url.pathname.startsWith("/t/")) {
      return { kind: "video", url: url.toString() };
    }
    return { kind: "invalid", reason: "プロフィールURLか動画URLを入力してください" };
  }

  const username = text.replace(/^@/, "");
  if (USERNAME_RE.test(username)) return { kind: "user", username };
  return { kind: "invalid", reason: "ユーザー名は英数字・ピリオド・アンダースコア（30文字まで）です" };
}

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

export function isValidVideoId(id: string): boolean {
  return /^\d{5,25}$/.test(id);
}

// ---------- 数値・文字列の安全な取り出し ----------
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === "string" && v) return v;
  for (const v of vals) if (typeof v === "number") return String(v);
  return "";
};
const num = (...vals: unknown[]): number => {
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return 0;
};

// tikwm は「/video/cover/xxx.webp」のような相対パスを返すことがある
export function absolutize(url: string, base = "https://www.tikwm.com"): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${base}${url}`;
  return url;
}

// tikwm の /api/user/info と、tiktok.com の埋め込みJSON（userInfo）はほぼ同じ形
export function normalizeProfile(userInfo: unknown, source: Profile["source"]): Profile | null {
  const info = obj(userInfo);
  const user = obj(info.user);
  const stats = obj(info.statsV2 && Object.keys(obj(info.statsV2)).length ? info.statsV2 : info.stats);
  const username = str(user.uniqueId, user.unique_id);
  if (!username) return null;
  return {
    id: str(user.id, user.uid),
    username,
    nickname: str(user.nickname) || username,
    avatar: absolutize(str(user.avatarLarger, user.avatarMedium, user.avatarThumb, user.avatar)),
    bio: str(user.signature),
    verified: Boolean(user.verified),
    isPrivate: Boolean(user.privateAccount ?? user.secret),
    region: str(user.region),
    followers: num(stats.followerCount, stats.follower_count),
    following: num(stats.followingCount, stats.following_count),
    likes: num(stats.heartCount, stats.heart, stats.total_favorited),
    videoCount: num(stats.videoCount, stats.aweme_count),
    source,
  };
}

// tikwm の動画1件（/api/user/posts の videos[] と /api/ の data）を整える
export function normalizeVideo(raw: unknown, fallbackAuthor = ""): Video | null {
  const v = obj(raw);
  const id = str(v.video_id, v.aweme_id, v.id);
  if (!id) return null;
  const author = obj(v.author);
  const images = Array.isArray(v.images) ? v.images : [];
  const music = obj(v.music_info);
  return {
    id,
    author: str(author.unique_id, author.uniqueId) || fallbackAuthor,
    title: str(v.title),
    cover: absolutize(str(v.cover, v.origin_cover, v.ai_dynamic_cover)),
    duration: num(v.duration),
    createdAt: num(v.create_time),
    views: num(v.play_count),
    likes: num(v.digg_count),
    comments: num(v.comment_count),
    shares: num(v.share_count),
    saves: num(v.collect_count),
    pinned: Boolean(v.is_top),
    isPhoto: images.length > 0,
    imageCount: images.length,
    music: [str(music.title), str(music.author)].filter(Boolean).join(" - "),
  };
}

// ダウンロード時のファイル名（OSで使えない文字を除く）
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "tiktok";
}
