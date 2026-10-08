"use client";
// ブラウザから直接 tikwm.com に問い合わせる予備の経路。
// tikwm はクラウド（Vercel など）のサーバーからの接続を拒否することがあるが、
// 自宅やスマホの回線からなら通るため、サーバーで失敗したときだけこちらを使う。
import { absolutize, normalizeProfile, normalizeVideo } from "./parse";
import type { MediaKind, Profile, Video, VideoPage } from "./types";

const BASE = "https://www.tikwm.com";
const GAP_MS = 1100; // 無料APIは1秒に1回まで

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

async function call(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = queue.then(async () => {
      const wait = lastCall + GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      if (!res.ok) throw new Error(`tikwm.com に接続できませんでした（${res.status}）`);
      return (await res.json()) as { code?: number; msg?: string; data?: unknown };
    });
    queue = run.catch(() => undefined);
    let body: { code?: number; msg?: string; data?: unknown };
    try {
      body = await run;
    } catch (e) {
      throw e instanceof TypeError ? new Error("tikwm.com に接続できませんでした（ネットワーク）") : e;
    }
    if (body.code === 0 && body.data && typeof body.data === "object") return body.data as Record<string, unknown>;
    const msg = String(body.msg ?? "");
    if (/limit|request\/second|too many/i.test(msg) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(msg ? `取得に失敗しました：${msg}` : "取得に失敗しました");
  }
  throw new Error("混雑しています。少し待ってから再度お試しください");
}

export async function directProfile(username: string): Promise<Profile> {
  const p = normalizeProfile(await call("/api/user/info", { unique_id: username }), "tikwm");
  if (!p) throw new Error("プロフィールを読み取れませんでした");
  return p;
}

export async function directVideos(username: string, cursor: string): Promise<VideoPage> {
  const data = await call("/api/user/posts", { unique_id: username, count: "30", cursor: cursor || "0" });
  const list = Array.isArray(data.videos) ? data.videos : [];
  const videos = list.map((v) => normalizeVideo(v, username)).filter((v): v is Video => v !== null);
  return { videos, cursor: String(data.cursor ?? ""), hasMore: Boolean(data.hasMore ?? data.has_more) && videos.length > 0 };
}

export type DirectDetail = Video & { urls: Partial<Record<Exclude<MediaKind, "image">, string>>; images: string[] };

const detailCache = new Map<string, { at: number; value: DirectDetail }>();

export async function directDetail(url: string): Promise<DirectDetail> {
  const hit = detailCache.get(url);
  if (hit && Date.now() - hit.at < 4 * 60_000) return hit.value;
  const data = await call("/api/", { url, hd: "1" });
  const base = normalizeVideo(data);
  if (!base) throw new Error("動画の情報を読み取れませんでした");
  const s = (k: string) => (typeof data[k] === "string" ? absolutize(data[k] as string) : "");
  const musicInfo = (data.music_info ?? {}) as Record<string, unknown>;
  const urls: DirectDetail["urls"] = {};
  if (s("hdplay") || s("play")) urls.hd = s("hdplay") || s("play");
  if (s("play")) urls.sd = s("play");
  if (s("wmplay")) urls.wm = s("wmplay");
  const music = s("music") || (typeof musicInfo.play === "string" ? absolutize(musicInfo.play) : "");
  if (music) urls.music = music;
  const images = Array.isArray(data.images) ? data.images.filter((x): x is string => typeof x === "string").map((x) => absolutize(x)) : [];
  const value = { ...base, urls, images };
  detailCache.set(url, { at: Date.now(), value });
  return value;
}

export const pageUrl = (id: string, author: string) => `https://www.tiktok.com/@${author || "_"}/video/${id}`;

// 種類ごとの配信元URL（ブラウザから直接開く用）
export async function directMediaUrl(id: string, author: string, kind: MediaKind, index = 0): Promise<string> {
  const d = await directDetail(pageUrl(id, author));
  const url = kind === "image" ? d.images[index] : d.urls[kind] ?? (kind === "sd" ? d.urls.hd : undefined);
  if (!url) throw new Error("この投稿ではその形式は取得できません");
  return url;
}
