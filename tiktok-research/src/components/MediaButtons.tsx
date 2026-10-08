"use client";
import { Download, Images, Music, Video as VideoIcon } from "lucide-react";
import type { MediaKind } from "@/lib/types";
import type { Job } from "./useDownloads";

type Target = { id: string; author: string; title: string; isPhoto: boolean; imageCount: number };

// 1本の投稿に対する保存ボタン一式
export default function MediaButtons({ target, available, onDownload }: { target: Target; available?: string[]; onDownload: (jobs: Job[]) => void }) {
  const has = (k: MediaKind) => !available || available.includes(k);
  const job = (kind: MediaKind, label: string, index?: number): Job => ({
    key: `${target.id}-${kind}-${index ?? 0}`,
    id: target.id,
    author: target.author,
    kind,
    index,
    label: `${target.title || target.id}（${label}）`,
  });

  return (
    <div className="tr-media-btns">
      {target.isPhoto ? (
        <button
          type="button"
          className="tr-btn tr-btn--primary tr-btn--sm"
          onClick={() => onDownload(Array.from({ length: Math.max(target.imageCount, 1) }, (_, i) => job("image", `写真 ${i + 1}`, i)))}
        >
          <Images size={16} /> 写真をすべて保存（{target.imageCount}枚）
        </button>
      ) : (
        <>
          {(has("hd") || has("sd")) && (
            <button type="button" className="tr-btn tr-btn--primary tr-btn--sm" onClick={() => onDownload([job("hd", "HD・透かしなし")])}>
              <Download size={16} /> HD・透かしなし
            </button>
          )}
          {has("sd") && (
            <button type="button" className="tr-btn tr-btn--ghost tr-btn--sm" onClick={() => onDownload([job("sd", "標準画質")])}>
              <VideoIcon size={16} /> 標準画質
            </button>
          )}
          {has("wm") && (
            <button type="button" className="tr-btn tr-btn--ghost tr-btn--sm" onClick={() => onDownload([job("wm", "透かしあり")])}>
              <VideoIcon size={16} /> 透かしあり
            </button>
          )}
        </>
      )}
      {has("music") && (
        <button type="button" className="tr-btn tr-btn--ghost tr-btn--sm" onClick={() => onDownload([job("music", "音声")])}>
          <Music size={16} /> 音声 MP3
        </button>
      )}
    </div>
  );
}
