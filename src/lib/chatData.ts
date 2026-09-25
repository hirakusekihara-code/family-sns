// チャット用の擬似データ（Mockデータ）
import { currentUserId, familyMembers } from "./mockData";

export type CallType = "voice" | "video";

export type ChatMessage = {
  id: string;
  senderId: string;
  time: string; // 「18:02」などの表示用テキスト
  liked?: boolean; // ダブルタップで ❤️
} & (
  | { kind: "text"; text: string }
  | { kind: "photo"; emoji: string; gradient: string }
  | { kind: "call"; callType: CallType; durationSec: number | null } // null = 応答なし
);

export type Conversation = {
  id: string;
  type: "group" | "dm";
  title: string;
  memberIds: string[]; // 自分以外の参加者
  unread: number;
};

export const GROUP_ID = "group";

export const initialConversations: Conversation[] = [
  {
    id: GROUP_ID,
    type: "group",
    title: "家族グループ",
    memberIds: familyMembers.filter((m) => m.id !== currentUserId).map((m) => m.id),
    unread: 0,
  },
  ...familyMembers
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({
      id: `dm-${m.id}`,
      type: "dm" as const,
      title: m.name,
      memberIds: [m.id],
      unread: m.id === "hana" ? 2 : 0,
    })),
];

export const initialMessages: Record<string, ChatMessage[]> = {
  [GROUP_ID]: [
    { id: "g1", senderId: "papa", time: "7:30", kind: "text", text: "おはよう！今日は18時まで仕事です" },
    { id: "g2", senderId: "mama", time: "7:30", kind: "text", text: "了解〜 気をつけてね" },
    { id: "g3", senderId: "sora", time: "12:10", kind: "photo", emoji: "🍙", gradient: "from-amber-200 to-orange-300" },
    { id: "g4", senderId: "sora", time: "12:10", kind: "text", text: "お弁当おいしかった！" },
    { id: "g5", senderId: "hana", time: "15:45", kind: "text", text: "部活おわったら帰るね", liked: true },
    { id: "g6", senderId: "mama", time: "16:02", kind: "call", callType: "video", durationSec: 245 },
    { id: "g7", senderId: "papa", time: "16:20", kind: "text", text: "今日の夕飯なに？🍽️" },
  ],
  "dm-papa": [
    { id: "d1", senderId: "papa", time: "昨日", kind: "text", text: "帰りに牛乳買ってくるね" },
    { id: "d2", senderId: "mama", time: "昨日", kind: "text", text: "ありがとう！助かる" },
    { id: "d3", senderId: "papa", time: "昨日", kind: "call", callType: "voice", durationSec: 72 },
  ],
  "dm-hana": [
    { id: "d4", senderId: "hana", time: "15:50", kind: "text", text: "ママ、明日の体操服洗ってある？" },
    { id: "d5", senderId: "hana", time: "15:51", kind: "text", text: "あと友達の家寄ってもいい？🙏" },
  ],
  "dm-sora": [
    { id: "d6", senderId: "mama", time: "8:00", kind: "text", text: "水筒忘れてるよ！" },
    { id: "d7", senderId: "sora", time: "8:05", kind: "text", text: "あ、ほんとだ😂" },
  ],
};

// 自動返信用のセリフ（プロトタイプで「受信」を体験するため）
export const autoReplies: Record<string, string[]> = {
  papa: ["了解！", "今から帰るね🚃", "いいね👍", "あとで電話するね"],
  mama: ["はーい", "わかったよ", "ありがとう😊"],
  hana: ["わかった〜", "えー！まじで？😂", "ありがとう！", "今部活中！あとでね"],
  sora: ["OK!", "おなかすいた🍙", "りょ", "あとでね〜"],
};

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function messagePreview(msg: ChatMessage | undefined) {
  if (!msg) return "";
  if (msg.kind === "text") return msg.text;
  if (msg.kind === "photo") return "写真を送信しました";
  const label = msg.callType === "video" ? "ビデオ通話" : "音声通話";
  return msg.durationSec === null ? `${label}（応答なし）` : `${label} ${formatDuration(msg.durationSec)}`;
}

// 配列からランダムに1つ選ぶ（自動返信などで使用）
export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
