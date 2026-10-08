"use client";
import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { compact, engagementOf, percent } from "@/lib/stats";
import type { Video } from "@/lib/types";
import MediaButtons from "./MediaButtons";
import { downloadUrl, type Job } from "./useDownloads";
import { formatDate } from "./VideoCard";

export default function VideoModal({ video, onClose, onDownload }: { video: Video; onClose: () => void; onDownload: (jobs: Job[]) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const pageUrl = `https://www.tiktok.com/@${video.author}/video/${video.id}`;

  return (
    <div className="tr-modal" role="dialog" aria-modal="true" aria-label="投稿のプレビュー" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tr-modal__box">
        <button ref={closeRef} type="button" className="tr-modal__close" onClick={onClose} aria-label="閉じる">
          <X size={20} />
        </button>
        <div className="tr-modal__stage">
          {video.isPhoto ? (
            <div className="tr-photos">
              {Array.from({ length: Math.max(video.imageCount, 1) }, (_, i) => (
                <img key={i} src={downloadUrl({ id: video.id, author: video.author, kind: "image", index: i }, { inline: "1" })} alt={`写真 ${i + 1}`} loading="lazy" />
              ))}
            </div>
          ) : (
            <video
              key={video.id}
              src={downloadUrl({ id: video.id, author: video.author, kind: "sd" }, { inline: "1" })}
              poster={video.cover || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          )}
        </div>
        <div className="tr-modal__info">
          <p className="tr-modal__title">{video.title || "（タイトルなし）"}</p>
          <p className="tr-muted">
            {formatDate(video.createdAt)} ・ {compact(video.views)} 再生 ・ いいね {compact(video.likes)} ・ コメント {compact(video.comments)} ・ シェア{" "}
            {compact(video.shares)} ・ 保存 {compact(video.saves)} ・ ER {percent(engagementOf(video))}
          </p>
          {video.music && <p className="tr-muted">♪ {video.music}</p>}
          <MediaButtons target={video} onDownload={onDownload} />
          <a className="tr-link" href={pageUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={14} /> TikTokで開く
          </a>
        </div>
      </div>
    </div>
  );
}
