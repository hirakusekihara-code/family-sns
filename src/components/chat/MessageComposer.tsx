"use client";

import { useState } from "react";
import { Camera, Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  onSendText: (text: string) => void;
  onSendPhoto: () => void;
};

// インスタ風の入力欄：左にカメラ、文字が無いときは❤️、あるときは「送信」
export default function MessageComposer({ onSendText, onSendPhoto }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const hasText = text.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasText) return;
    onSendText(text.trim());
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-4">
        <button
          type="button"
          onClick={onSendPhoto}
          aria-label={t("chat.sendPhoto")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
        >
          <Camera className="h-5 w-5" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
        {hasText ? (
          <button type="submit" className="text-[15px] font-semibold text-indigo-600">
            {t("chat.send")}
          </button>
        ) : (
          <button type="button" onClick={() => onSendText("❤️")} aria-label={t("chat.sendHeart")}>
            <Heart className="h-6 w-6 text-slate-700" />
          </button>
        )}
      </div>
    </form>
  );
}
