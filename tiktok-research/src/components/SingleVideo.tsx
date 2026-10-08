"use client";
import { ExternalLink } from "lucide-react";
import { compact, engagementOf, percent } from "@/lib/stats";
import type { Video } from "@/lib/types";
import MediaButtons from "./MediaButtons";
import PreviewVideo, { PreviewImage } from "./PreviewVideo";
import type { Job } from "./useDownloads";
import { formatDate } from "./VideoCard";

export type SingleVideoData = Omit<Video, "imageCount"> & { available: string[]; images: number; imageCount?: number };

// 動画URLを入れたときの、1本だけの表示
export default function SingleVideo({ data, onDownload }: { data: SingleVideoData; onDownload: (jobs: Job[]) => void }) {
  const video: Video = { ...data, imageCount: data.images };
  const available = video.isPhoto ? [...data.available, "image"] : data.available;
  return (
    <section className="tr-card tr-single">
      <div className="tr-single__media">
        {video.isPhoto ? (
          <PreviewImage id={video.id} author={video.author} index={0} alt="写真 1" />
        ) : (
          <PreviewVideo id={video.id} author={video.author} poster={video.cover} />
        )}
      </div>
      <div className="tr-single__info">
        <p className="tr-muted">@{video.author}</p>
        <p className="tr-modal__title">{video.title || "（タイトルなし）"}</p>
        <ul className="tr-stats tr-stats--small">
          <li>
            <b>{compact(video.views)}</b>再生
          </li>
          <li>
            <b>{compact(video.likes)}</b>いいね
          </li>
          <li>
            <b>{compact(video.comments)}</b>コメント
          </li>
          <li>
            <b>{percent(engagementOf(video), 1)}</b>ER
          </li>
        </ul>
        <p className="tr-muted">{formatDate(video.createdAt)}{video.music ? ` ・ ♪ ${video.music}` : ""}</p>
        <MediaButtons target={video} available={available} onDownload={onDownload} />
        <a className="tr-link" href={`https://www.tiktok.com/@${video.author}/video/${video.id}`} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={14} /> TikTokで開く
        </a>
      </div>
    </section>
  );
}
