// カレンダー・家計簿用の擬似データ（Mockデータ）と日付の計算
import { familyMembers, getMember } from "./mockData";

// ---------- 型 ----------

export type MoneyType = "expense" | "income"; // 出金 / 入金

export type AttachmentKind = "receipt" | "invoice" | "other";

export const attachmentKinds: AttachmentKind[] = ["receipt", "invoice", "other"];

export type Attachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  url: string; // ブラウザ内だけで使える一時的なURL
  mimeType: string;
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
  initialBalance: number; // 記録を始める前の残高
};

export const ledgers: Ledger[] = [
  { id: "household", emoji: "🏠", initialBalance: 0 },
  ...familyMembers
    .filter((m) => m.role === "child")
    .map((m) => ({
      id: `allowance-${m.id}`,
      emoji: "👛",
      ownerId: m.id,
      initialBalance: m.id === "hana" ? 2500 : 800,
    })),
];

export function getLedger(id: string): Ledger {
  return ledgers.find((l) => l.id === id) ?? ledgers[0];
}

// 担当者ごとの標準の帳簿：子どもはお小遣い帳、親は家計
export function defaultLedgerFor(memberId: string): string {
  const member = getMember(memberId);
  return member.role === "child" ? `allowance-${member.id}` : "household";
}

// 見られる帳簿：親はすべて、子どもは自分のお小遣い帳だけ
export function visibleLedgers(viewerId: string): Ledger[] {
  const viewer = getMember(viewerId);
  return viewer.role === "parent" ? ledgers : ledgers.filter((l) => l.ownerId === viewer.id);
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

// ---------- Mockデータ ----------

// 領収書・請求書のダミー画像（SVG）
const mockDocumentTitles: Record<AttachmentKind, string> = { receipt: "領収書", invoice: "請求書", other: "書類" };

function mockDocument(kind: AttachmentKind, store: string, amount: number): string {
  const title = mockDocumentTitles[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
<rect width="300" height="400" fill="#fffdf7"/><rect x="0.5" y="0.5" width="299" height="399" fill="none" stroke="#d6d3d1"/>
<text x="150" y="60" font-size="28" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1e293b">${title}</text>
<text x="150" y="110" font-size="18" text-anchor="middle" font-family="sans-serif" fill="#475569">${store}</text>
<line x1="30" y1="140" x2="270" y2="140" stroke="#cbd5e1" stroke-dasharray="4 4"/>
<text x="30" y="200" font-size="16" font-family="sans-serif" fill="#475569">合計</text>
<text x="270" y="200" font-size="26" text-anchor="end" font-family="sans-serif" font-weight="bold" fill="#1e293b">${formatYen(amount)}</text>
<line x1="30" y1="230" x2="270" y2="230" stroke="#cbd5e1" stroke-dasharray="4 4"/>
<text x="150" y="360" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#94a3b8">（サンプル画像）</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mockAttachment(id: string, kind: AttachmentKind, store: string, amount: number): Attachment {
  return {
    id,
    name: `${mockDocumentTitles[kind]}_${store}.svg`,
    kind,
    url: mockDocument(kind, store, amount),
    mimeType: "image/svg+xml",
  };
}

type MockInput = Omit<CalendarEvent, "id" | "date" | "attachments" | "place" | "memo" | "allDay" | "start" | "end"> &
  Partial<Pick<CalendarEvent, "place" | "memo" | "allDay" | "start" | "end" | "attachments">> & { offset: number };

// 今日を基準に、前後の日付へ予定を並べる（いつ開いても予定が入った状態に見えるように）
export function buildMockEvents(today: string): CalendarEvent[] {
  const inputs: MockInput[] = [
    { offset: 0, title: "勤務", assigneeId: "papa", createdById: "papa", start: "09:00", end: "18:00", spotId: "office" },
    { offset: 0, title: "部活（バスケ）", assigneeId: "hana", createdById: "hana", start: "16:00", end: "18:00", spotId: "junior-high" },
    { offset: 0, title: "サッカー練習", assigneeId: "sora", createdById: "mama", start: "17:00", end: "18:30", spotId: "ground" },
    {
      offset: 0, title: "スーパーで買い出し", assigneeId: "mama", createdById: "mama", start: "11:00", end: "12:00", spotId: "supermarket",
      money: { type: "expense", amount: 3480, category: "food", ledgerId: "household" },
      attachments: [mockAttachment("a1", "receipt", "スーパー", 3480)],
    },
    { offset: 1, title: "勤務", assigneeId: "papa", createdById: "papa", start: "09:00", end: "18:00", spotId: "office" },
    {
      offset: 1, title: "電気代の引き落とし", assigneeId: "mama", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 8650, category: "utilities", ledgerId: "household" },
      attachments: [mockAttachment("a2", "invoice", "でんき株式会社", 8650)],
    },
    {
      offset: 2, title: "歯医者（定期検診）", assigneeId: "sora", createdById: "mama", start: "15:30", end: "16:00", spotId: "clinic",
      memo: "保険証を忘れずに",
      money: { type: "expense", amount: 1200, category: "medical", ledgerId: "household" },
    },
    { offset: 3, title: "飲み会", assigneeId: "papa", createdById: "papa", start: "19:00", end: "22:00", place: "駅前の居酒屋" },
    { offset: 5, title: "授業参観", assigneeId: "mama", createdById: "mama", start: "10:00", end: "11:30", spotId: "elementary" },
    { offset: 5, title: "英会話教室", assigneeId: "hana", createdById: "mama", start: "18:00", end: "19:00",
      money: { type: "expense", amount: 6600, category: "lessons", ledgerId: "household" } },
    { offset: 8, title: "家族でキャンプ🏕️", assigneeId: "papa", createdById: "papa", allDay: true, place: "森のキャンプ場" },
    { offset: 12, title: "サッカーの試合", assigneeId: "sora", createdById: "papa", start: "09:00", end: "12:00", spotId: "ground" },
    {
      offset: -1, title: "はなにお小遣い", assigneeId: "mama", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 3000, category: "allowance", ledgerId: "household" },
    },
    {
      offset: -1, title: "お小遣い", assigneeId: "hana", createdById: "mama", allDay: true,
      money: { type: "income", amount: 3000, category: "allowance", ledgerId: "allowance-hana" },
    },
    {
      offset: -1, title: "マンガを買った", assigneeId: "hana", createdById: "hana", start: "17:00", end: "17:30", place: "駅前の本屋",
      money: { type: "expense", amount: 880, category: "leisure", ledgerId: "allowance-hana" },
      attachments: [mockAttachment("a3", "receipt", "駅前の本屋", 880)],
    },
    {
      offset: -3, title: "給料日", assigneeId: "papa", createdById: "papa", allDay: true,
      money: { type: "income", amount: 320000, category: "salary", ledgerId: "household" },
    },
    {
      offset: -4, title: "ドラッグストア", assigneeId: "mama", createdById: "mama", start: "14:00", end: "14:30",
      money: { type: "expense", amount: 2150, category: "daily", ledgerId: "household" },
    },
    {
      offset: -5, title: "お小遣い", assigneeId: "sora", createdById: "mama", allDay: true,
      money: { type: "income", amount: 500, category: "allowance", ledgerId: "allowance-sora" },
    },
    {
      offset: -5, title: "駄菓子屋", assigneeId: "sora", createdById: "sora", start: "16:00", end: "16:30",
      money: { type: "expense", amount: 150, category: "snacks", ledgerId: "allowance-sora" },
    },
    {
      offset: -8, title: "塾の月謝", assigneeId: "hana", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 22000, category: "education", ledgerId: "household" },
      attachments: [mockAttachment("a4", "invoice", "さくら学習塾", 22000)],
    },
    {
      offset: -12, title: "週末の買い出し", assigneeId: "papa", createdById: "papa", start: "10:00", end: "11:00", spotId: "supermarket",
      money: { type: "expense", amount: 12400, category: "food", ledgerId: "household" },
    },
    {
      offset: -20, title: "ガス代", assigneeId: "mama", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 5400, category: "utilities", ledgerId: "household" },
    },
    {
      offset: -30, title: "給料日", assigneeId: "papa", createdById: "papa", allDay: true,
      money: { type: "income", amount: 320000, category: "salary", ledgerId: "household" },
    },
    {
      offset: -33, title: "月末のまとめ買い", assigneeId: "mama", createdById: "mama", allDay: true, spotId: "supermarket",
      money: { type: "expense", amount: 28600, category: "food", ledgerId: "household" },
    },
    {
      offset: -38, title: "塾の月謝", assigneeId: "hana", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 22000, category: "education", ledgerId: "household" },
    },
    {
      offset: -45, title: "電気代", assigneeId: "mama", createdById: "mama", allDay: true,
      money: { type: "expense", amount: 9800, category: "utilities", ledgerId: "household" },
    },
  ];

  return inputs.map(({ offset, ...rest }, i) => ({
    id: `ev${i + 1}`,
    date: addDays(today, offset),
    allDay: false,
    start: "09:00",
    end: "10:00",
    place: "",
    memo: "",
    attachments: [],
    ...rest,
  }));
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
