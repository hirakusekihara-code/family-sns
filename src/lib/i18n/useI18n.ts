"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getMember, type FamilyMember, type Spot } from "@/lib/mockData";
import { en, ja, type MessageKey } from "./messages";

export type Lang = "ja" | "en";

const STORAGE_KEY = "family-sns-lang";
let memoryLang: Lang | null = null; // ブラウザの保存機能が使えないときの予備
const listeners = new Set<() => void>();

function readLang(): Lang {
  if (memoryLang) return memoryLang;
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ja";
  } catch {
    return "ja";
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// 言語を切り替える（選んだ言語はブラウザに保存され、次回も同じ言語で開きます）
export function setLang(lang: Lang) {
  memoryLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 保存できなくても、この画面を開いている間は切り替わります
  }
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  // サーバーで作るHTMLは日本語。ブラウザで保存された言語に切り替わります
  return useSyncExternalStore(subscribe, readLang, () => "ja");
}

type Vars = Record<string, string | number>;

export function createI18n(lang: Lang) {
  const dict = lang === "en" ? en : ja;

  const t = (key: MessageKey, vars?: Vars) =>
    dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ""));

  const memberName = (m: FamilyMember) => (lang === "en" ? m.nameEn : m.name);

  return {
    lang,
    t,
    memberName,
    spotName: (s: Spot) => (lang === "en" ? s.nameEn : s.name),
    categoryLabel: (id: string) => t(`cat.${id}` as MessageKey),
    ledgerName: (ledger: { ownerId?: string }) =>
      ledger.ownerId
        ? t("ledger.allowance", { name: memberName(getMember(ledger.ownerId)) })
        : t("ledger.household"),
    weekdays: lang === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["日", "月", "火", "水", "木", "金", "土"],
    // 「9月25日（金）」/「Fri, Sep 25」
    formatDate: (key: string) => {
      const [y, m, d] = key.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return lang === "en"
        ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : `${m}月${d}日（${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}）`;
    },
    // 「2026年9月」/「September 2026」
    monthTitle: ({ year, month }: { year: number; month: number }) =>
      lang === "en"
        ? new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : `${year}年${month + 1}月`,
    // 「30分前」/「30m ago」
    formatAgo: (minutes: number) => {
      if (minutes < 1) return t("common.justNow");
      if (minutes < 60) return t("common.minutesAgo", { n: minutes });
      if (minutes < 60 * 24) return t("common.hoursAgo", { n: Math.floor(minutes / 60) });
      return t("common.yesterday");
    },
    // チャットの時刻表示（"yesterday" だけ翻訳）
    formatChatTime: (time: string) => (time === "yesterday" ? t("common.yesterday") : time),
    // 帳票用の金額：マイナスは日本語「△1,200」、英語「(1,200)」
    formatAccounting: (n: number) => {
      const abs = Math.abs(n).toLocaleString("en-US");
      if (n >= 0) return abs;
      return lang === "en" ? `(${abs})` : `△${abs}`;
    },
  };
}

export type I18n = ReturnType<typeof createI18n>;

export function useI18n(): I18n {
  const lang = useLang();
  return useMemo(() => createI18n(lang), [lang]);
}
