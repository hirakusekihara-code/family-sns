"use client";
import { useState } from "react";
import { directMediaUrl } from "@/lib/direct";
import { downloadUrl } from "./useDownloads";

// サーバー経由で再生できなければ、ブラウザから配信元を直接再生する
export default function PreviewVideo({ id, author, poster, autoPlay }: { id: string; author: string; poster?: string; autoPlay?: boolean }) {
  const [src, setSrc] = useState(() => downloadUrl({ id, author, kind: "sd" }, { inline: "1" }));
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const onError = async () => {
    if (tried) {
      setFailed(true);
      return;
    }
    setTried(true);
    try {
      setSrc(await directMediaUrl(id, author, "sd"));
    } catch {
      setFailed(true);
    }
  };

  if (failed) return <p className="tr-muted tr-center">プレビューを再生できませんでした。下の保存ボタンをお試しください。</p>;
  return <video key={src} src={src} poster={poster || undefined} controls autoPlay={autoPlay} playsInline preload="metadata" onError={onError} />;
}

// 写真も同じく、だめならブラウザから直接
export function PreviewImage({ id, author, index, alt }: { id: string; author: string; index: number; alt: string }) {
  const [src, setSrc] = useState(() => downloadUrl({ id, author, kind: "image", index }, { inline: "1" }));
  const [tried, setTried] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={async () => {
        if (tried) return;
        setTried(true);
        try {
          setSrc(await directMediaUrl(id, author, "image", index));
        } catch {
          /* 表示できないまま */
        }
      }}
    />
  );
}
