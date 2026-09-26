"use client";

import { useRef, useState } from "react";
import { Camera, Heart } from "lucide-react";
import { resizePhoto } from "@/lib/profile/image";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  onSendText: (text: string) => Promise<boolean>;
  onSendPhoto: (photo: string) => Promise<boolean>;
};

// インスタ風の入力欄：左にカメラ（写真を送る）、文字が無いときは❤️、あるときは「送信」
export default function MessageComposer({ onSendText, onSendPhoto }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasText = text.trim().length > 0;

  async function send(fn: () => Promise<boolean>, clear = false) {
    if (busy) return;
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok && clear) setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (hasText) send(() => onSendText(text.trim()), true);
      }}
      className="border-t border-slate-100 bg-white px-3 py-2"
    >
      <div className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t("chat.sendPhoto")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
        >
          <Camera className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              const photo = await resizePhoto(file);
              send(() => onSendPhoto(photo));
            }
          }}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
        {hasText ? (
          <button type="submit" disabled={busy} className="text-[15px] font-semibold text-indigo-600 disabled:opacity-50">
            {t("chat.send")}
          </button>
        ) : (
          <button type="button" onClick={() => send(() => onSendText("❤️"))} aria-label={t("chat.sendHeart")}>
            <Heart className="h-6 w-6 text-slate-700" />
          </button>
        )}
      </div>
    </form>
  );
}
