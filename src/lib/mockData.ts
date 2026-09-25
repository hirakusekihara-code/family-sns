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

export function getMember(id: string): FamilyMember {
  return familyMembers.find((m) => m.id === id) ?? familyMembers[0];
}

// ---------- タイムライン ----------

export type ReactionType = "like" | "happy" | "sad";

export const reactionTypes: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "いいね" },
  { type: "happy", emoji: "😊", label: "嬉しい" },
  { type: "sad", emoji: "😢", label: "悲しい" },
];

export type Comment = {
  id: string;
  authorId: string;
  text: string;
  timeLabel: string;
};

export type Post = {
  id: string;
  authorId: string;
  text: string;
  timeLabel: string; // 「2時間前」などの表示用テキスト
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
    timeLabel: "30分前",
    photo: photoOptions[2],
    reactions: { like: 3, happy: 2, sad: 0 },
    myReactions: [],
    comments: [
      { id: "c1", authorId: "papa", text: "すごいぞ！見に行けなくてごめんな", timeLabel: "20分前" },
      { id: "c2", authorId: "hana", text: "おめでとー！", timeLabel: "10分前" },
    ],
  },
  {
    id: "p2",
    authorId: "papa",
    text: "今日は残業で遅くなります。夕飯は先に食べててね🙏",
    timeLabel: "2時間前",
    reactions: { like: 1, happy: 0, sad: 2 },
    myReactions: [],
    comments: [],
  },
  {
    id: "p3",
    authorId: "hana",
    text: "学校の帰りに桜がきれいだった🌸",
    timeLabel: "5時間前",
    photo: photoOptions[0],
    reactions: { like: 2, happy: 3, sad: 0 },
    myReactions: ["happy"],
    comments: [{ id: "c3", authorId: "mama", text: "満開だね！週末お花見行こうか", timeLabel: "4時間前" }],
  },
  {
    id: "p4",
    authorId: "mama",
    text: "今夜はカレーです🍛 おかわりたくさんあるよ",
    timeLabel: "昨日",
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
