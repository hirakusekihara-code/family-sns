// カレンダー・家計簿の型と、日付・金額の計算
import type { Member } from "./family";

// ---------- 型 ----------

export type MoneyType = "expense" | "income"; // 出金 / 入金

export type AttachmentKind = "receipt" | "invoice" | "other";

export const attachmentKinds: AttachmentKind[] = ["receipt", "invoice", "other"];

export type Attachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  storagePath?: string; // 保存済みのファイルの場所（Supabase Storage）
  url?: string; // 表示用の一時的なURL（開くときに作る）
  file?: File; // まだ保存していない、新しく選んだファイル
};

export type Money = {
  type: MoneyType;
  amount: number;
  category: string; // 科目のID（"food" など）。表示名は言語ごとの対訳表から
  ledgerId: string; // どの帳簿（家計 / お小遣い）に記録するか
};

export type CalendarEvent = {
  id: string;
  title: string;
  assigneeId: string; // 担当（誰の予定か）
  createdById: string; // 登録した人
  date: string; // "2026-09-25" の形式
  allDay: boolean;
  start: string; // "09:00"
  end: string; // "18:00"
  spotId?: string;
  place: string;
  memo: string;
  money?: Money;
  attachments: Attachment[];
};

// ---------- 帳簿（家計・お小遣い） ----------

export type Ledger = {
  id: string; // 表示名は言語に合わせて「家計」「はなのお小遣い」などに変換
  emoji: string;
  ownerId?: string; // お小遣い帳の持ち主（家計は undefined）
  ownerName?: string;
  initialBalance: number; // 記録を始める前の残高
};

// 帳簿の一覧：家計 ＋ 子ども（息子・娘）ひとりずつのお小遣い帳
export function ledgersFor(members: Member[]): Ledger[] {
  return [
    { id: "household", emoji: "🏠", initialBalance: 0 },
    ...members
      .filter((m) => m.role === "child")
      .map((m) => ({ id: `allowance-${m.id}`, emoji: "👛", ownerId: m.id, ownerName: m.name, initialBalance: 0 })),
  ];
}

export function findLedger(all: Ledger[], id: string): Ledger {
  return all.find((l) => l.id === id) ?? { id, emoji: "👛", initialBalance: 0 };
}

// 担当者ごとの標準の帳簿：子どもはお小遣い帳、それ以外は家計
export function defaultLedgerFor(member: Member): string {
  return member.role === "child" ? `allowance-${member.id}` : "household";
}

// 見られる帳簿：保護者はすべて、子どもは自分のお小遣い帳だけ、親族はなし
// （データベースの安全設定でも同じように守られています）
export function visibleLedgers(all: Ledger[], viewer: Member): Ledger[] {
  if (viewer.role === "parent") return all;
  return all.filter((l) => l.ownerId === viewer.id);
}

// 科目のID（表示名は messages.ts の "cat.〇〇"）
export const categories: Record<MoneyType, string[]> = {
  expense: ["food", "daily", "education", "lessons", "transport", "medical", "utilities", "leisure", "snacks", "allowance", "other"],
  income: ["salary", "allowance", "gift", "extra", "other"],
};

// ---------- 日付の計算 ----------

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

// 月 = { year, month }（month は 0〜11）
export type YearMonth = { year: number; month: number };

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function shiftMonth({ year, month }: YearMonth, diff: number): YearMonth {
  const d = new Date(year, month + diff, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const result: YearMonth[] = [];
  let cur = from;
  while (monthKey(cur) <= monthKey(to) && result.length < 24) {
    result.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return result;
}

// 月カレンダーに並べる42日分（6週 × 7日、日曜はじまり）
export function monthGridDays({ year, month }: YearMonth): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateKey(d);
  });
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

// ---------- 家計簿の集計 ----------

export type Transaction = CalendarEvent & { money: Money };

export function transactionsOf(events: CalendarEvent[], ledgerId: string): Transaction[] {
  return events.filter((e): e is Transaction => e.money?.ledgerId === ledgerId);
}

export function sumBy(list: Transaction[], type: MoneyType): number {
  return list.filter((t) => t.money.type === type).reduce((sum, t) => sum + t.money.amount, 0);
}

export function inMonth(list: Transaction[], ym: YearMonth): Transaction[] {
  const prefix = monthKey(ym);
  return list.filter((t) => t.date.startsWith(prefix));
}
