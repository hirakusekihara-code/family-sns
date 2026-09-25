// 擬似データ（Mockデータ）
// 本物のデータベースを使う前に、画面の動きを確認するためのダミーデータです。

export type FamilyMember = {
  id: string;
  name: string;
  nameEn: string; // 英語表示用の名前
  emoji: string; // アイコン代わりの絵文字
  color: string; // Tailwind の背景色クラス（カレンダーの色分けなどで使用）
  role: "parent" | "child"; // 親：家計を管理 / 子：お小遣いを管理
};

export const familyMembers: FamilyMember[] = [
  { id: "papa", name: "パパ", nameEn: "Dad", emoji: "👨", color: "bg-sky-500", role: "parent" },
  { id: "mama", name: "ママ", nameEn: "Mom", emoji: "👩", color: "bg-rose-500", role: "parent" },
  { id: "hana", name: "はな", nameEn: "Hana", emoji: "👧", color: "bg-amber-500", role: "child" },
  { id: "sora", name: "そら", nameEn: "Sora", emoji: "👦", color: "bg-emerald-500", role: "child" },
];

// よく行く場所（カレンダーの「場所」やマップで使用）
export type Spot = {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
};

export const spots: Spot[] = [
  { id: "home", name: "自宅", nameEn: "Home", emoji: "🏠" },
  { id: "office", name: "パパの会社", nameEn: "Dad's office", emoji: "🏢" },
  { id: "junior-high", name: "中学校", nameEn: "Junior high", emoji: "🏫" },
  { id: "elementary", name: "小学校", nameEn: "Elementary school", emoji: "🎒" },
  { id: "ground", name: "サッカー場", nameEn: "Soccer field", emoji: "⚽" },
  { id: "supermarket", name: "スーパー", nameEn: "Supermarket", emoji: "🛒" },
  { id: "clinic", name: "歯医者", nameEn: "Dentist", emoji: "🦷" },
];

export function getSpot(id: string | undefined): Spot | undefined {
  return spots.find((s) => s.id === id);
}

// ログイン中のユーザー（プロトタイプなので固定）
export const currentUserId = "mama";

export function getMember(id: string): FamilyMember {
  return familyMembers.find((m) => m.id === id) ?? familyMembers[0];
}

// ---------- タイムライン ----------

export type ReactionType = "like" | "happy" | "sad";

// 表示名は言語ごとの対訳表（"reaction.like" など）から
export const reactionTypes: { type: ReactionType; emoji: string }[] = [
  { type: "like", emoji: "👍" },
  { type: "happy", emoji: "😊" },
  { type: "sad", emoji: "😢" },
];

export type Comment = {
  id: string;
  authorId: string;
  text: string;
  minutesAgo: number; // 何分前か（0 = たった今）。表示は言語に合わせて「30分前」「30m ago」など
};

export type Post = {
  id: string;
  authorId: string;
  text: string;
  minutesAgo: number;
  photo?: { emoji: string; gradient: string }; // 写真の代わりのダミー画像
  reactions: Record<ReactionType, number>; // 各リアクションの合計数
  myReactions: ReactionType[]; // 自分が押したリアクション
  comments: Comment[];
};

export const photoOptions = [
  { emoji: "🌸", gradient: "from-pink-300 to-rose-400" },
  { emoji: "🍛", gradient: "from-amber-300 to-orange-400" },
  { emoji: "⚽", gradient: "from-emerald-300 to-teal-500" },
  { emoji: "🌊", gradient: "from-sky-300 to-blue-500" },
  { emoji: "🎂", gradient: "from-fuchsia-300 to-purple-500" },
];

export const initialPosts: Post[] = [
  {
    id: "p1",
    authorId: "sora",
    text: "サッカーの試合でゴール決めた！⚽ 来週も頑張る！",
    minutesAgo: 30,
    photo: photoOptions[2],
    reactions: { like: 3, happy: 2, sad: 0 },
    myReactions: [],
    comments: [
      { id: "c1", authorId: "papa", text: "すごいぞ！見に行けなくてごめんな", minutesAgo: 20 },
      { id: "c2", authorId: "hana", text: "おめでとー！", minutesAgo: 10 },
    ],
  },
  {
    id: "p2",
    authorId: "papa",
    text: "今日は残業で遅くなります。夕飯は先に食べててね🙏",
    minutesAgo: 120,
    reactions: { like: 1, happy: 0, sad: 2 },
    myReactions: [],
    comments: [],
  },
  {
    id: "p3",
    authorId: "hana",
    text: "学校の帰りに桜がきれいだった🌸",
    minutesAgo: 300,
    photo: photoOptions[0],
    reactions: { like: 2, happy: 3, sad: 0 },
    myReactions: ["happy"],
    comments: [{ id: "c3", authorId: "mama", text: "満開だね！週末お花見行こうか", minutesAgo: 240 }],
  },
  {
    id: "p4",
    authorId: "mama",
    text: "今夜はカレーです🍛 おかわりたくさんあるよ",
    minutesAgo: 1440,
    photo: photoOptions[1],
    reactions: { like: 4, happy: 2, sad: 0 },
    myReactions: ["like"],
    comments: [],
  },
];

// 新しく作るデータ用の簡易ID
let idCounter = 0;
export function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}
