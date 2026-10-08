"use client";
import { Download, Eye, Heart, Images, MessageCircle, Pin, Play, Share2 } from "lucide-react";
import { compact, engagementOf, percent } from "@/lib/stats";
import type { Video } from "@/lib/types";

export const formatDate = (t: number) =>
  t ? new Date(t * 1000).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : "";

export const formatDuration = (s: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

export function VideoCard({ video, onOpen, onDownload }: { video: Video; onOpen: () => void; onDownload: () => void }) {
  return (
    <article className="tr-vcard">
      <div className="tr-vcard__media">
        {video.cover && <img src={video.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        <button type="button" className="tr-vcard__open" onClick={onOpen} aria-label="プレビュー">
          <span>{video.isPhoto ? <Images size={22} /> : <Play size={22} fill="currentColor" />}</span>
        </button>
        <button type="button" className="tr-vcard__dl" onClick={onDownload} aria-label="保存" title={video.isPhoto ? "写真を保存" : "透かしなしHDで保存"}>
          <Download size={18} />
        </button>
        <div className="tr-vcard__badges">
          {video.pinned && (
            <span className="tr-badge">
              <Pin size={11} /> 固定
            </span>
          )}
          {video.isPhoto ? <span className="tr-badge">写真 {video.imageCount}枚</span> : video.duration > 0 && <span className="tr-badge">{formatDuration(video.duration)}</span>}
        </div>
        <span className="tr-vcard__views">
          <Eye size={13} /> {compact(video.views)}
        </span>
      </div>
      <div className="tr-vcard__body">
        <p className="tr-vcard__title" title={video.title}>
          {video.title || "（タイトルなし）"}
        </p>
        <div className="tr-vcard__metrics">
          <span title="いいね">
            <Heart size={13} /> {compact(video.likes)}
          </span>
          <span title="コメント">
            <MessageCircle size={13} /> {compact(video.comments)}
          </span>
          <span title="シェア">
            <Share2 size={13} /> {compact(video.shares)}
          </span>
        </div>
        <div className="tr-vcard__foot">
          <span>{formatDate(video.createdAt)}</span>
          <span title="エンゲージメント率">ER {percent(engagementOf(video), 1)}</span>
        </div>
      </div>
    </article>
  );
}
