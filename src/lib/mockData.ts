// アプリで使う固定のデータ（よく行く場所・リアクションの種類）と小さな関数

// よく行く場所（カレンダーの「場所」やマップで使用）
export type Spot = {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
};

export const spots: Spot[] = [
  { id: "home", name: "自宅", nameEn: "Home", emoji: "🏠" },
  { id: "office", name: "会社", nameEn: "Office", emoji: "🏢" },
  { id: "junior-high", name: "中学校", nameEn: "Junior high", emoji: "🏫" },
  { id: "elementary", name: "小学校", nameEn: "Elementary school", emoji: "🎒" },
  { id: "ground", name: "サッカー場", nameEn: "Soccer field", emoji: "⚽" },
  { id: "supermarket", name: "スーパー", nameEn: "Supermarket", emoji: "🛒" },
  { id: "clinic", name: "歯医者", nameEn: "Dentist", emoji: "🦷" },
];

export function getSpot(id: string | undefined): Spot | undefined {
  return spots.find((s) => s.id === id);
}

// ---------- タイムライン ----------

export type ReactionType = "like" | "happy" | "sad";

// 表示名は言語ごとの対訳表（"reaction.like" など）から
export const reactionTypes: { type: ReactionType; emoji: string }[] = [
  { type: "like", emoji: "👍" },
  { type: "happy", emoji: "😊" },
  { type: "sad", emoji: "😢" },
];

// 新しく作るデータ用の簡易ID
let idCounter = 0;
export function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}
