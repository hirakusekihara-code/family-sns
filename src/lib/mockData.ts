// 擬似データ（Mockデータ）
// 本物のデータベースを使う前に、画面の動きを確認するためのダミーデータです。

export type FamilyMember = {
  id: string;
  name: string;
  emoji: string; // アイコン代わりの絵文字
  color: string; // Tailwind の背景色クラス（カレンダーの色分けなどで使用）
};

export const familyMembers: FamilyMember[] = [
  { id: "papa", name: "パパ", emoji: "👨", color: "bg-sky-500" },
  { id: "mama", name: "ママ", emoji: "👩", color: "bg-rose-500" },
  { id: "hana", name: "はな", emoji: "👧", color: "bg-amber-500" },
  { id: "sora", name: "そら", emoji: "👦", color: "bg-emerald-500" },
];

// ログイン中のユーザー（プロトタイプなので固定）
export const currentUserId = "mama";
