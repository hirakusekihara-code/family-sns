// サーバー専用：TikTok のデータを取ってくる処理
// 1) tikwm.com の公開API（プロフィール・動画一覧・透かしなし動画URL）
// 2) プロフィールだけは tiktok.com の公開ページに埋め込まれたJSONでも代替できる
// 公開アカウントの公開情報だけを扱う。非公開アカウントの中身を取りに行くことはしない。
import "server-only";
import { absolutize, isValidVideoId, normalizeProfile, normalizeVideo } from "./parse";
import { mockProfile, mockVideos } from "./mock";
import type { MediaKind, Profile, Video, VideoPage } from "./types";

export const MOCK = process.env.TT_MOCK === "1";

const TIKWM = "https://www.tikwm.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

// ---------- 無料APIの「1秒に1回まで」を守るための順番待ち ----------
const GAP_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

// ---------- 短時間のメモリキャッシュ（同じ問い合わせを繰り返さない） ----------
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

type TikwmResponse = { code?: number; msg?: string; data?: unknown };

async function tikwm(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${TIKWM}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await throttled(async () => {
      let res: Response;
      try {
        res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      } catch {
        throw new UpstreamError("取得元のサーバーに接続できませんでした");
      }
      if (!res.ok) throw new UpstreamError(`取得元のサーバーがエラーを返しました（${res.status}）`);
      return (await res.json().catch(() => ({}))) as TikwmResponse;
    });
    if (body.code === 0 && body.data && typeof body.data === "object") return body.data as Record<string, unknown>;
    const msg = String(body.msg ?? "");
    // 混雑時は少し待ってやり直す
    if (/limit|request\/second|too many/i.test(msg) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (/not exist|not found|unique_id|invalid/i.test(msg)) throw new UpstreamError("見つかりませんでした", 404);
    if (/private/i.test(msg)) throw new UpstreamError("非公開アカウントのため取得できません", 403);
    throw new UpstreamError(msg ? `取得に失敗しました：${msg}` : "取得に失敗しました");
  }
  throw new UpstreamError("混雑しています。少し待ってから再度お試しください", 429);
}

// tiktok.com の公開プロフィールページから埋め込みJSONを読む（tikwm が使えないときの予備）
async function profileFromTiktok(username: string): Promise<Profile | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}?lang=ja`, {
      headers: { "User-Agent": UA, "Accept-Language": "ja,en;q=0.8", Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const userInfo = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
    return normalizeProfile(userInfo, "tiktok");
  } catch {
    return null;
  }
}

export async function getProfile(username: string): Promise<Profile> {
  if (MOCK) return mockProfile(username);
  return cached(`p:${username.toLowerCase()}`, 5 * 60_000, async () => {
    let failure: unknown = new UpstreamError("プロフィールを読み取れませんでした");
    try {
      const p = normalizeProfile(await tikwm("/api/user/info", { unique_id: username }), "tikwm");
      if (p) return p;
    } catch (e) {
      failure = e;
    }
    const alt = await profileFromTiktok(username);
    if (alt) return alt;
    throw failure;
  });
}

export async function getVideos(username: string, cursor: string): Promise<VideoPage> {
  if (MOCK) return mockVideos(username, cursor);
  return cached(`v:${username.toLowerCase()}:${cursor}`, 3 * 60_000, async () => {
    const data = await tikwm("/api/user/posts", { unique_id: username, count: "30", cursor: cursor || "0" });
    const list = Array.isArray(data.videos) ? data.videos : [];
    const videos = list.map((v) => normalizeVideo(v, username)).filter((v): v is Video => v !== null);
    return {
      videos,
      cursor: String(data.cursor ?? ""),
      hasMore: Boolean(data.hasMore ?? data.has_more) && videos.length > 0,
    };
  });
}

// ---------- 動画1本の詳細（ダウンロード用URLを含む） ----------
export type VideoDetail = Video & {
  media: Partial<Record<Exclude<MediaKind, "image">, string>>;
  images: string[];
};

function toDetail(data: Record<string, unknown>): VideoDetail {
  const base = normalizeVideo(data);
  if (!base) throw new UpstreamError("動画の情報を読み取れませんでした");
  const s = (k: string) => (typeof data[k] === "string" ? absolutize(data[k] as string) : "");
  const musicInfo = (data.music_info ?? {}) as Record<string, unknown>;
  const music = s("music") || (typeof musicInfo.play === "string" ? absolutize(musicInfo.play) : "");
  const images = Array.isArray(data.images) ? data.images.filter((x): x is string => typeof x === "string").map((x) => absolutize(x)) : [];
  const media: VideoDetail["media"] = {};
  if (s("hdplay")) media.hd = s("hdplay");
  if (s("play")) media.sd = s("play");
  if (s("wmplay")) media.wm = s("wmplay");
  if (music) media.music = music;
  return { ...base, media, images };
}

// url は動画ページのURL（短縮URLも可）
export async function getVideoDetail(url: string): Promise<VideoDetail> {
  if (MOCK) {
    const id = url.match(/(\d{5,25})/)?.[1] ?? "7300000000000000000";
    const v = mockVideos("sample", "0").videos[0];
    return { ...v, id, media: {}, images: [] };
  }
  return cached(`d:${url}`, 10 * 60_000, async () => toDetail(await tikwm("/api/", { url, hd: "1" })));
}

export function videoPageUrl(id: string, author: string): string {
  if (!isValidVideoId(id)) throw new UpstreamError("動画IDが正しくありません", 400);
  return `https://www.tiktok.com/@${author || "_"}/video/${id}`;
}

// ダウンロード元として許可するホスト（それ以外へは絶対に接続しない）
const ALLOWED_MEDIA_HOST = /(^|\.)(tikwm\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|tiktokv\.com|tiktokv\.us|tiktok\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|muscdn\.com|bytecdn\.cn)$/i;

export function assertMediaUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UpstreamError("ファイルのURLが正しくありません");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UpstreamError("ファイルのURLが正しくありません");
  if (!ALLOWED_MEDIA_HOST.test(u.hostname)) throw new UpstreamError("想定外の配信元のため中止しました", 400);
  return u;
}

export async function fetchMedia(url: URL, range: string | null): Promise<Response> {
  const headers: Record<string, string> = { "User-Agent": UA, Referer: "https://www.tiktok.com/" };
  if (range) headers.Range = range;
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store", redirect: "follow" });
  } catch {
    throw new UpstreamError("ファイルの配信元に接続できませんでした");
  }
  if (!res.ok && res.status !== 206) throw new UpstreamError(`ファイルを取得できませんでした（${res.status}）`);
  return res;
}
