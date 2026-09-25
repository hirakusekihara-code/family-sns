"use client";

import { Globe } from "lucide-react";
import { setLang, useI18n, type Lang } from "@/lib/i18n/useI18n";

const options: { lang: Lang; label: string }[] = [
  { lang: "ja", label: "日本語" },
  { lang: "en", label: "EN" },
];

// 言語切り替えボタン（日本語 / 英語）
export default function LanguageToggle() {
  const { lang, t } = useI18n();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("lang.label")}>
      <Globe className="h-4 w-4 text-slate-400" aria-hidden />
      <div className="flex rounded-full bg-slate-100 p-0.5">
        {options.map((o) => (
          <button
            key={o.lang}
            type="button"
            onClick={() => setLang(o.lang)}
            aria-pressed={lang === o.lang}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
              lang === o.lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
