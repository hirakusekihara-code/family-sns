"use client";
// ダウンロードを1件ずつ順番に実行し、進み具合を表示するための仕組み
import { useCallback, useRef, useState } from "react";
import type { MediaKind } from "@/lib/types";

export type Job = {
  key: string;
  id: string;
  author: string;
  kind: MediaKind;
  index?: number;
  label: string;
};

export type JobState = Job & {
  status: "waiting" | "running" | "done" | "error" | "cancelled";
  loaded: number;
  total: number;
  message?: string;
  link?: string; // 自動保存できなかったときに、配信元を直接開くためのリンク
};

export function downloadUrl(job: Pick<Job, "id" | "author" | "kind" | "index">, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ id: job.id, author: job.author, kind: job.kind, ...extra });
  if (job.index !== undefined) q.set("i", String(job.index));
  return `/api/download?${q}`;
}

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* 下の候補へ */
    }
  }
  return cd.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function useDownloads() {
  const [jobs, setJobs] = useState<JobState[]>([]);
  const queue = useRef<Job[]>([]);
  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const patch = useCallback((key: string, p: Partial<JobState>) => {
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...p } : j)));
  }, []);

  const runOne = useCallback(
    async (job: Job) => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      patch(job.key, { status: "running", loaded: 0, total: 0 });
      try {
        const res = await fetch(downloadUrl(job), { signal: ctrl.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `失敗しました（${res.status}）`);
        }
        const total = Number(res.headers.get("content-length") ?? 0);
        const reader = res.body?.getReader();
        const chunks: BlobPart[] = [];
        let loaded = 0;
        let lastPaint = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (Date.now() - lastPaint > 120) {
              lastPaint = Date.now();
              patch(job.key, { loaded, total });
            }
          }
        } else {
          chunks.push(await res.arrayBuffer());
        }
        const type = res.headers.get("content-type") ?? "application/octet-stream";
        saveBlob(new Blob(chunks, { type }), filenameFrom(res, `${job.author}_${job.id}`));
        patch(job.key, { status: "done", loaded, total: total || loaded });
      } catch (e) {
        if (ctrl.signal.aborted) patch(job.key, { status: "cancelled", message: "中止しました" });
        else patch(job.key, { status: "error", message: e instanceof Error ? e.message : "失敗しました", link: downloadUrl(job, { redirect: "1" }) });
      } finally {
        abort.current = null;
      }
    },
    [patch],
  );

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const job = queue.current.shift()!;
      await runOne(job);
    }
    running.current = false;
  }, [runOne]);

  const enqueue = useCallback(
    (list: Job[]) => {
      const fresh = list.map((j) => ({ ...j, key: `${j.key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}` }));
      queue.current.push(...fresh);
      setJobs((cur) => [...cur.filter((j) => j.status === "running" || j.status === "waiting"), ...fresh.map((j) => ({ ...j, status: "waiting" as const, loaded: 0, total: 0 }))]);
      void pump();
    },
    [pump],
  );

  // 待ち行列を空にして、実行中のものも止める
  const stopAll = useCallback(() => {
    const waiting = new Set(queue.current.map((j) => j.key));
    queue.current = [];
    setJobs((list) => list.map((j) => (waiting.has(j.key) ? { ...j, status: "cancelled", message: "中止しました" } : j)));
    abort.current?.abort();
  }, []);

  const clear = useCallback(() => setJobs((list) => list.filter((j) => j.status === "running" || j.status === "waiting")), []);

  return { jobs, enqueue, stopAll, clear };
}
