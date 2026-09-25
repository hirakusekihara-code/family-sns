"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n/useI18n";

// <html lang="..."> を選んだ言語に合わせる（読み上げ機能などのため）
export default function HtmlLang() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
