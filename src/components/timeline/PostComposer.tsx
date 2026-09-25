"use client";

import { useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { familyMembers, getMember, photoOptions, type Post } from "@/lib/mockData";
import Avatar from "./Avatar";

type Props = {
  defaultAuthorId: string;
  onSubmit: (post: Pick<Post, "authorId" | "text" | "photo">) => void;
};

// 新しい投稿を作るフォーム
export default function PostComposer({ defaultAuthorId, onSubmit }: Props) {
  const [authorId, setAuthorId] = useState(defaultAuthorId);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Post["photo"]>();
  const [showPhotos, setShowPhotos] = useState(false);

  const canSubmit = text.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ authorId, text: text.trim(), photo });
    setText("");
    setPhoto(undefined);
    setShowPhotos(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      {/* 誰として投稿するか選ぶ */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">投稿者</span>
        {familyMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setAuthorId(m.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              authorId === m.id ? `${m.color} text-white` : "bg-slate-100 text-slate-500"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Avatar member={getMember(authorId)} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="家族にシェアしよう…"
          rows={2}
          className="flex-1 resize-none rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {photo && (
        <div className={`relative flex h-32 items-center justify-center rounded-xl bg-gradient-to-br text-5xl ${photo.gradient}`}>
          {photo.emoji}
          <button
            type="button"
            onClick={() => setPhoto(undefined)}
            className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white"
            aria-label="写真を外す"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showPhotos && !photo && (
        <div className="flex gap-2">
          {photoOptions.map((p) => (
            <button
              key={p.emoji}
              type="button"
              onClick={() => setPhoto(p)}
              className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-2xl ${p.gradient}`}
            >
              {p.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPhotos((v) => !v)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ImagePlus className="h-5 w-5" />
          写真
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" />
          投稿
        </button>
      </div>
    </form>
  );
}
