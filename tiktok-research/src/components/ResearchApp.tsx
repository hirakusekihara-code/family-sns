"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronsDown,
  CircleAlert,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Lock,
  RotateCcw,
  Search,
} from "lucide-react";
import { parseInput } from "@/lib/parse";
import { compact, sortVideos, toCsv, type SortKey } from "@/lib/stats";
import type { Profile, Video, VideoPage } from "@/lib/types";
import ResearchPanel from "./ResearchPanel";
import { VideoCard } from "./VideoCard";
import VideoModal from "./VideoModal";
import DownloadPanel from "./DownloadPanel";
import SingleVideo, { type SingleVideoData } from "./SingleVideo";
import { useDownloads, type Job } from "./useDownloads";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `エラー（${res.status}）`);
  return body as T;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "新しい順" },
  { key: "oldest", label: "古い順" },
  { key: "views", label: "再生数" },
  { key: "likes", label: "いいね" },
  { key: "comments", label: "コメント" },
  { key: "shares", label: "シェア" },
  { key: "engagement", label: "エンゲージメント率" },
];

const LOAD_ALL_LIMIT = 1000;

export default function ResearchApp() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState("0");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [listError, setListError] = useState("");
  const [single, setSingle] = useState<SingleVideoData | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState("");
  const [onlyVideos, setOnlyVideos] = useState(false);
  const [open, setOpen] = useState<Video | null>(null);
  const stopAllLoad = useRef(false);
  const searchAbort = useRef<AbortController | null>(null);
  const downloads = useDownloads();

  const reset = useCallback(() => {
    searchAbort.current?.abort();
    stopAllLoad.current = true;
    setProfile(null);
    setVideos([]);
    setCursor("0");
    setHasMore(false);
    setSingle(null);
    setError("");
    setListError("");
    setFilter("");
    setSort("newest");
    setBusy(false);
  }, []);

  const loadPage = useCallback(async (username: string, from: string, signal?: AbortSignal): Promise<VideoPage> => {
    return getJson<VideoPage>(`/api/videos?${new URLSearchParams({ u: username, cursor: from })}`, signal);
  }, []);

  const appendPage = useCallback((page: VideoPage) => {
    setVideos((cur) => {
      const seen = new Set(cur.map((v) => v.id));
      return [...cur, ...page.videos.filter((v) => !seen.has(v.id))];
    });
    setCursor(page.cursor);
    setHasMore(page.hasMore);
  }, []);

  const submit = useCallback(
    async (raw?: string) => {
      const text = raw ?? input;
      const parsed = parseInput(text);
      if (parsed.kind === "invalid") {
        setError(parsed.reason);
        return;
      }
      reset();
      stopAllLoad.current = false;
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      setBusy(true);
      try {
        if (parsed.kind === "video") {
          setSingle(await getJson<SingleVideoData>(`/api/video?${new URLSearchParams({ url: parsed.url })}`, ctrl.signal));
          return;
        }
        const p = await getJson<Profile>(`/api/profile?u=${encodeURIComponent(parsed.username)}`, ctrl.signal);
        setProfile(p);
        if (p.isPrivate) return; // 非公開アカウントの動画は取得しない
        try {
          appendPage(await loadPage(p.username, "0", ctrl.signal));
        } catch (e) {
          if (!ctrl.signal.aborted) setListError(e instanceof Error ? e.message : "動画一覧を取得できませんでした");
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "取得できませんでした");
      } finally {
        if (searchAbort.current === ctrl) setBusy(false);
      }
    },
    [input, reset, loadPage, appendPage],
  );

  const loadMore = useCallback(async () => {
    if (!profile || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setListError("");
    try {
      appendPage(await loadPage(profile.username, cursor));
    } catch (e) {
      setListError(e instanceof Error ? e.message : "続きを取得できませんでした");
    } finally {
      setLoadingMore(false);
    }
  }, [profile, hasMore, loadingMore, cursor, loadPage, appendPage]);

  // 分析の精度を上げるため、全動画（上限あり）をまとめて読み込む
  const loadAll = useCallback(async () => {
    if (!profile || !hasMore) return;
    stopAllLoad.current = false;
    setLoadingAll(true);
    setListError("");
    let from = cursor;
    let more: boolean = hasMore;
    let count = videos.length;
    try {
      while (more && !stopAllLoad.current && count < LOAD_ALL_LIMIT) {
        const page = await loadPage(profile.username, from);
        appendPage(page);
        from = page.cursor;
        more = page.hasMore;
        count += page.videos.length;
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "続きを取得できませんでした");
    } finally {
      setLoadingAll(false);
    }
  }, [profile, hasMore, cursor, videos.length, loadPage, appendPage]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = videos.filter((v) => (!q || v.title.toLowerCase().includes(q)) && (!onlyVideos || !v.isPhoto));
    return sortVideos(list, sort);
  }, [videos, filter, sort, onlyVideos]);

  const jobFor = (v: Video): Job[] =>
    v.isPhoto
      ? Array.from({ length: Math.max(v.imageCount, 1) }, (_, i) => ({ key: `${v.id}-img${i}`, id: v.id, author: v.author, kind: "image" as const, index: i, label: `${v.title || v.id}（写真 ${i + 1}）` }))
      : [{ key: v.id, id: v.id, author: v.author, kind: "hd" as const, label: v.title || v.id }];

  const downloadShown = () => {
    if (!shown.length) return;
    if (shown.length > 20 && !window.confirm(`${shown.length} 件を順番に保存します。よろしいですか？`)) return;
    downloads.enqueue(shown.flatMap(jobFor));
  };

  const exportCsv = () => {
    if (!profile) return;
    const blob = new Blob([toCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${profile.username}_videos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text.trim());
        setError("");
      }
    } catch {
      setError("貼り付けが許可されませんでした。長押し／Ctrl+V で貼り付けてください");
    }
  };

  useEffect(() => () => searchAbort.current?.abort(), []);

  const hasResult = Boolean(profile || single);

  return (
    <main className="tr-page">
      <header className="tr-hero">
        <div className="tr-brand">
          <span className="tr-logo" aria-hidden="true">
            <Search size={22} strokeWidth={2.6} />
          </span>
          <div>
            <h1>TikTok リサーチ</h1>
            <p>公開アカウントの分析と、動画・写真・音声の保存（個人用）</p>
          </div>
        </div>

        <form
          className="tr-search"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="tr-input">ユーザー名・プロフィールURL・動画URL</label>
          <div className="tr-search__row">
            <input
              id="tr-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError("");
              }}
              placeholder="@username / tiktok.com/@username / 動画のURL"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            <div className="tr-search__actions">
              <button type="button" className="tr-btn tr-btn--ghost" onClick={paste}>
                <ClipboardPaste size={18} /> 貼り付け
              </button>
              <button type="submit" className="tr-btn tr-btn--primary" disabled={busy}>
                {busy ? <LoaderCircle size={18} className="tr-spin" /> : <Search size={18} />} 調べる
              </button>
              {hasResult && (
                <button
                  type="button"
                  className="tr-btn tr-btn--ghost"
                  onClick={() => {
                    reset();
                    setInput("");
                  }}
                >
                  <RotateCcw size={18} /> クリア
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="tr-alert" role="alert">
              <CircleAlert size={16} /> {error}
            </p>
          )}
        </form>
      </header>

      {busy && !hasResult && <Skeleton />}

      {single && <SingleVideo data={single} onDownload={(jobs) => downloads.enqueue(jobs)} />}

      {profile && (
        <>
          <section className="tr-card tr-profile">
            <img className="tr-profile__avatar" src={profile.avatar || undefined} alt="" referrerPolicy="no-referrer" />
            <div className="tr-profile__meta">
              <h2>
                {profile.nickname}
                {profile.verified && <BadgeCheck size={20} className="tr-verified" aria-label="認証済み" />}
              </h2>
              <a href={`https://www.tiktok.com/@${profile.username}`} target="_blank" rel="noreferrer noopener" className="tr-handle">
                @{profile.username}
              </a>
              {profile.bio && <p className="tr-bio">{profile.bio}</p>}
              <div className="tr-profile__tags">
                {profile.region && <span className="tr-chip">地域 {profile.region}</span>}
                {profile.isPrivate && (
                  <span className="tr-chip tr-chip--warn">
                    <Lock size={13} /> 非公開
                  </span>
                )}
                {profile.source === "mock" && <span className="tr-chip tr-chip--warn">サンプルデータ</span>}
              </div>
            </div>
            <ul className="tr-stats">
              <li>
                <b>{compact(profile.followers)}</b>フォロワー
              </li>
              <li>
                <b>{compact(profile.following)}</b>フォロー中
              </li>
              <li>
                <b>{compact(profile.likes)}</b>いいね
              </li>
              <li>
                <b>{compact(profile.videoCount)}</b>投稿
              </li>
            </ul>
          </section>

          {profile.isPrivate ? (
            <section className="tr-card tr-empty">
              <Lock size={32} />
              <p>このアカウントは非公開です。公開されている情報（上のプロフィール）以外は取得しません。</p>
            </section>
          ) : (
            <>
              {videos.length > 0 && <ResearchPanel videos={videos} profile={profile} onOpen={setOpen} />}

              <section className="tr-card">
                <div className="tr-list__head">
                  <h3>
                    投稿一覧 <small>{videos.length !== shown.length ? `${shown.length} / ` : ""}{videos.length} 件読み込み済み</small>
                  </h3>
                  <div className="tr-list__tools">
                    <input className="tr-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="タイトル・#タグで絞り込み" />
                    <select className="tr-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="並び替え">
                      {SORTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <label className="tr-check">
                      <input type="checkbox" checked={onlyVideos} onChange={(e) => setOnlyVideos(e.target.checked)} /> 動画のみ
                    </label>
                    <button type="button" className="tr-btn tr-btn--ghost tr-btn--sm" onClick={exportCsv} disabled={!shown.length}>
                      <FileSpreadsheet size={16} /> CSV
                    </button>
                    <button type="button" className="tr-btn tr-btn--accent tr-btn--sm" onClick={downloadShown} disabled={!shown.length}>
                      <Download size={16} /> 表示中をすべて保存
                    </button>
                  </div>
                </div>

                {listError && (
                  <p className="tr-alert" role="alert">
                    <CircleAlert size={16} /> {listError}
                  </p>
                )}

                {busy && !videos.length ? (
                  <GridSkeleton />
                ) : shown.length ? (
                  <div className="tr-grid">
                    {shown.map((v) => (
                      <VideoCard key={v.id} video={v} onOpen={() => setOpen(v)} onDownload={() => downloads.enqueue(jobFor(v))} />
                    ))}
                  </div>
                ) : (
                  !busy && <p className="tr-muted tr-center">{videos.length ? "条件に合う投稿がありません" : "投稿が見つかりませんでした"}</p>
                )}

                {hasMore && (
                  <div className="tr-more">
                    <button type="button" className="tr-btn tr-btn--ghost" onClick={loadMore} disabled={loadingMore || loadingAll}>
                      {loadingMore ? <LoaderCircle size={18} className="tr-spin" /> : <ChevronsDown size={18} />} さらに読み込む
                    </button>
                    {loadingAll ? (
                      <button type="button" className="tr-btn tr-btn--ghost" onClick={() => (stopAllLoad.current = true)}>
                        <LoaderCircle size={18} className="tr-spin" /> 全件読み込み中…（{videos.length}件）止める
                      </button>
                    ) : (
                      <button type="button" className="tr-btn tr-btn--ghost" onClick={loadAll} disabled={loadingMore}>
                        <ChevronsDown size={18} /> 全件読み込む（最大{LOAD_ALL_LIMIT}件）
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {!hasResult && !busy && (
        <section className="tr-card tr-howto">
          <h3>使い方</h3>
          <ol>
            <li>
              <b>アカウントを調べる：</b>ユーザー名（例 <code>khaby.lame</code>）かプロフィールURLを入れて「調べる」。
              プロフィール・投稿一覧・平均再生数やエンゲージメント率・投稿の曜日／時間帯・よく使うハッシュタグが表示されます。
            </li>
            <li>
              <b>動画を保存する：</b>各投稿の <Download size={14} /> で透かしなしHD動画を保存。写真投稿は画像を1枚ずつ保存します。
              「表示中をすべて保存」でまとめて順番に保存できます。
            </li>
            <li>
              <b>動画1本だけ：</b>動画のURL（短縮URL <code>vm.tiktok.com/…</code> も可）を入れると、その動画を保存できます。
            </li>
          </ol>
          <p className="tr-muted">
            公開アカウントの公開情報のみを扱います。保存した動画は個人的な視聴・研究の範囲で使い、再配布はしないでください。
          </p>
        </section>
      )}

      <footer className="tr-footer">個人用ツール ・ Cookie／解析ツール不使用</footer>

      {open && <VideoModal video={open} onClose={() => setOpen(null)} onDownload={(jobs) => downloads.enqueue(jobs)} />}
      <DownloadPanel jobs={downloads.jobs} onStop={downloads.stopAll} onClear={downloads.clear} />
    </main>
  );
}

function Skeleton() {
  return (
    <section className="tr-card tr-profile" aria-busy="true">
      <div className="tr-sk tr-sk--avatar" />
      <div className="tr-profile__meta">
        <div className="tr-sk" style={{ width: "40%", height: 24 }} />
        <div className="tr-sk" style={{ width: "25%", height: 16 }} />
        <div className="tr-sk" style={{ width: "80%", height: 40 }} />
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="tr-grid" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="tr-sk tr-sk--card" />
      ))}
    </div>
  );
}

