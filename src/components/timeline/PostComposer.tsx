"use client";

import { useRef, useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { useFamily } from "@/lib/family";
import { resizePhoto } from "@/lib/profile/image";
import { useI18n } from "@/lib/i18n/useI18n";
import MemberAvatar from "@/components/common/MemberAvatar";

type Props = {
  onSubmit: (text: string, photo: string | null) => Promise<boolean>;
};

// 新しい投稿を作るフォーム（投稿者は自分）
export default function PostComposer({ onSubmit }: Props) {
  const { t } = useI18n();
  const family = useFamily();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!family.ready) return null;
  const canSubmit = (text.trim().length > 0 || photo !== null) && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const ok = await onSubmit(text.trim(), photo);
    setBusy(false);
    if (ok) {
      setText("");
      setPhoto(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <MemberAvatar member={family.me} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("tl.placeholder")}
          rows={2}
          className="flex-1 resize-none rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {photo && (
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- 端末で縮小した写真のプレビュー */}
          <img src={photo} alt="" className="max-h-72 w-full object-cover" />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
            aria-label={t("tl.removePhoto")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ImagePlus className="h-5 w-5" />
          {t("tl.photo")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setPhoto(await resizePhoto(file));
          }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" />
          {t("tl.post")}
        </button>
      </div>
    </form>
  );
}
