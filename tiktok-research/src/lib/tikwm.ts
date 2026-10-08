// サーバー専用：TikTok のデータを取ってくる処理
// 1) tikwm.com の公開API（プロフィール・動画一覧・透かしなし動画URL）
// 2) プロフィールだけは tiktok.com の公開ページに埋め込まれたJSONでも代替できる
// 公開アカウントの公開情報だけを扱う。非公開アカウントの中身を取りに行くことはしない。
import "server-only";
import { absolutize, extractItemStruct, isValidVideoId, normalizeProfile, normalizeTiktokItem, normalizeVideo } from "./parse";
import { mockProfile, mockVideos } from "./mock";
import type { MediaKind, Profile, Video, VideoPage } from "./types";

export const MOCK = process.env.TT_MOCK === "1";

const TIKWM = "https://www.tikwm.com";
// tikwm の公式API（RapidAPI 経由・キー認証）。無料の tikwm.com はクラウドのサーバーを拒否するが、こちらは使える
const RAPIDAPI_HOST = "tiktok-scraper7.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY?.trim() ?? "";
export const HAS_RAPIDAPI = Boolean(RAPIDAPI_KEY);
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
  // RapidAPI 版は同じ機能が "/api" を除いたパスにある（/user/info, /user/posts, /）
  const url = RAPIDAPI_KEY
    ? `https://${RAPIDAPI_HOST}${path.replace(/^\/api/, "") || "/"}?${new URLSearchParams(params)}`
    : `${TIKWM}${path}?${new URLSearchParams(params)}`;
  const headers: Record<string, string> = RAPIDAPI_KEY
    ? { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST, Accept: "application/json" }
    : { "User-Agent": UA, Accept: "application/json" };
  const name = RAPIDAPI_KEY ? "RapidAPI（tikwm 公式）" : "tikwm.com";
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await throttled(async () => {
      let res: Response;
      try {
        res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      } catch {
        throw new UpstreamError(`${name} に接続できませんでした`);
      }
      if (RAPIDAPI_KEY && (res.status === 401 || res.status === 403)) {
        throw new UpstreamError(`RapidAPI のキーが無効か、プランに登録されていません（${res.status}）`, 503);
      }
      if (RAPIDAPI_KEY && res.status === 429) throw new UpstreamError("RapidAPI の利用回数の上限に達しました（429）", 429);
      if (!res.ok) throw new UpstreamError(`取得元（${name}）がこのサーバーからの接続を拒否しました（${res.status}）`, res.status === 403 ? 503 : 502);
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
    // tiktok.com の公開ページを優先（Vercel からも読める）。だめなら tikwm
    const fromTiktok = await profileFromTiktok(username);
    if (fromTiktok) return fromTiktok;
    const p = normalizeProfile(await tikwm("/api/user/info", { unique_id: username }), "tikwm");
    if (p) return p;
    throw new UpstreamError("プロフィールを読み取れませんでした");
  });
}

// ---------- 投稿一覧：TikTok 本体のクリエイター用一覧API（署名不要、Vercel からも届く） ----------
// cursor は「この時刻(ミリ秒)より前の投稿」を意味する。tikwm の cursor と区別するため "t:" を付けて返す。
const TIKTOK_EPOCH_MS = 1_472_706_000_000; // 2016年9月（これより前の投稿は存在しない）
const DEVICE_ID = String(7_250_000_000_000_000_000n + BigInt(Math.floor(Math.random() * 1e15)));

async function tiktokListPage(secUid: string, username: string, cursorMs: number): Promise<{ items: unknown[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    aid: "1988",
    app_name: "tiktok_web",
    app_language: "ja-JP",
    browser_language: "ja",
    browser_name: "Mozilla",
    browser_online: "true",
    browser_platform: "Win32",
    browser_version: "5.0 (Windows)",
    channel: "tiktok_web",
    cookie_enabled: "true",
    count: "30",
    cursor: String(cursorMs),
    device_id: DEVICE_ID,
    device_platform: "web_pc",
    focus_state: "true",
    from_page: "user",
    history_len: "2",
    is_fullscreen: "false",
    is_page_visible: "true",
    language: "ja",
    os: "windows",
    priority_region: "",
    referer: "",
    region: "JP",
    screen_height: "1080",
    screen_width: "1920",
    secUid,
    type: "1", // 新しい → 古い の順
    tz_name: "Asia/Tokyo",
    verifyFp: `verify_${Math.random().toString(16).slice(2, 9)}`,
    webcast_language: "ja",
  });
  let res: Response;
  try {
    res = await fetch(`https://www.tiktok.com/api/creator/item_list/?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json", Referer: `https://www.tiktok.com/@${username}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new UpstreamError("TikTok に接続できませんでした");
  }
  if (!res.ok) throw new UpstreamError(`TikTok が投稿一覧を返しませんでした（${res.status}）`);
  const text = await res.text();
  if (!text.trim()) throw new UpstreamError("TikTok が空の応答を返しました");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new UpstreamError("TikTok の応答を読み取れませんでした");
  }
  return { items: Array.isArray(body.itemList) ? body.itemList : [], hasMore: Boolean(body.hasMorePrevious) };
}

async function videosFromTiktok(username: string, secUid: string, cursor: string): Promise<VideoPage> {
  let cursorMs = cursor.startsWith("t:") && cursor.length > 2 ? Number(cursor.slice(2)) : Date.now();
  // 投稿が少ない期間は空のページが返るので、数回さかのぼって探す
  for (let tries = 0; tries < 6; tries++) {
    const page = await tiktokListPage(secUid, username, cursorMs);
    const videos = page.items
      .map((it) => normalizeTiktokItem(it)?.video)
      .filter((v): v is Video => Boolean(v))
      .map((v) => ({ ...v, author: v.author || username }));
    const oldest = videos.reduce((min, v) => (v.createdAt && v.createdAt * 1000 < min ? v.createdAt * 1000 : min), cursorMs);
    const next = oldest < cursorMs ? oldest : cursorMs - 30 * 86_400_000;
    const hasMore = page.hasMore && next > TIKTOK_EPOCH_MS;
    if (videos.length || !hasMore) return { videos, cursor: `t:${next}`, hasMore };
    cursorMs = next;
  }
  return { videos: [], cursor: `t:${cursorMs}`, hasMore: cursorMs > TIKTOK_EPOCH_MS };
}

async function videosFromTikwm(username: string, cursor: string): Promise<VideoPage> {
  const data = await tikwm("/api/user/posts", { unique_id: username, count: "30", cursor: cursor || "0" });
  const list = Array.isArray(data.videos) ? data.videos : [];
  const videos = list.map((v) => normalizeVideo(v, username)).filter((v): v is Video => v !== null);
  return { videos, cursor: String(data.cursor ?? ""), hasMore: Boolean(data.hasMore ?? data.has_more) && videos.length > 0 };
}

export async function getVideos(username: string, cursor: string): Promise<VideoPage> {
  if (MOCK) return mockVideos(username, cursor);
  return cached(`v:${username.toLowerCase()}:${cursor}`, 3 * 60_000, async () => {
    // 続きのページは、最初に使った取得元と同じものを使う
    if (cursor && cursor !== "0" && !cursor.startsWith("t:")) return videosFromTikwm(username, cursor);
    // RapidAPI のキーがあれば、確実に動くそちらを優先
    if (HAS_RAPIDAPI && !cursor.startsWith("t:")) return videosFromTikwm(username, cursor);
    let failure: unknown;
    try {
      const { secUid } = await getProfile(username);
      if (secUid) return await videosFromTiktok(username, secUid, cursor);
    } catch (e) {
      failure = e;
    }
    if (cursor.startsWith("t:")) throw failure ?? new UpstreamError("投稿一覧を取得できませんでした");
    try {
      return await videosFromTikwm(username, cursor);
    } catch (e) {
      // 両方だめなら、TikTok 側の理由を優先して伝える
      throw failure instanceof UpstreamError ? new UpstreamError(`${failure.message}／予備（tikwm）も失敗：${e instanceof Error ? e.message : ""}`) : e;
    }
  });
}

// ---------- 動画1本の詳細（ダウンロード用URLを含む） ----------
export type VideoDetail = Video & {
  media: Partial<Record<Exclude<MediaKind, "image">, string>>;
  images: string[];
  cookie?: string; // tiktok.com の配信元から取るときに必要
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

// vm.tiktok.com/xxx などの短縮URLを、本来の動画URLに展開する
async function resolveShortUrl(url: string): Promise<string> {
  if (/\/video\/\d+|\/photo\/\d+/.test(url)) return url;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    await res.body?.cancel();
    return res.url || url;
  } catch {
    return url;
  }
}

// tiktok.com の動画ページを直接読む（Vercel からも接続できる経路）。
// 配信元のファイルは、そのページで受け取った Cookie を付けないと拒否されるので一緒に保持する。
async function detailFromTiktok(url: string): Promise<VideoDetail | null> {
  const m = url.match(/\/(?:video|photo)\/(\d+)/);
  if (!m) return null;
  try {
    const res = await fetch(`https://www.tiktok.com/@_/video/${m[1]}?lang=ja`, {
      headers: { "User-Agent": UA, "Accept-Language": "ja,en;q=0.8", Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const parsed = normalizeTiktokItem(extractItemStruct(await res.text()));
    if (!parsed || (!parsed.media.hd && !parsed.images.length)) return null;
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return { ...parsed.video, media: parsed.media, images: parsed.images, cookie };
  } catch {
    return null;
  }
}

// url は動画ページのURL（短縮URLも可）
// preferTikwm: Cookie なしで開ける配信元URLが欲しいとき（ブラウザで直接開く用）
export async function getVideoDetail(url: string, preferTikwm = false): Promise<VideoDetail> {
  if (MOCK) {
    const id = url.match(/(\d{5,25})/)?.[1] ?? "7300000000000000000";
    const v = mockVideos("sample", "0").videos[0];
    return { ...v, id, media: {}, images: [] };
  }
  const full = await resolveShortUrl(url);
  // 配信元の署名付きURLは数分で切れるので、キャッシュは短め
  const key = full.match(/\/(\d{5,25})/)?.[1] ?? full;
  if (preferTikwm) {
    try {
      return await cached(`dw:${key}`, 4 * 60_000, async () => toDetail(await tikwm("/api/", { url: full, hd: "1" })));
    } catch {
      /* 下の通常経路へ */
    }
  }
  return cached(`d:${key}`, 4 * 60_000, async () => {
    const fromTiktok = await detailFromTiktok(full);
    if (fromTiktok) return fromTiktok;
    return toDetail(await tikwm("/api/", { url: full, hd: "1" }));
  });
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

export async function fetchMedia(url: URL, range: string | null, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "User-Agent": UA, Referer: "https://www.tiktok.com/" };
  if (range) headers.Range = range;
  if (cookie && /(^|\.)tiktok\.com$/i.test(url.hostname)) headers.Cookie = cookie;
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store", redirect: "follow" });
  } catch {
    throw new UpstreamError("ファイルの配信元に接続できませんでした");
  }
  if (!res.ok && res.status !== 206) throw new UpstreamError(`ファイルを取得できませんでした（${res.status}）`);
  return res;
}
