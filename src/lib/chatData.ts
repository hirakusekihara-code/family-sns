// チャットの表示用の小さな関数
import type { I18n } from "./i18n/useI18n";
import type { ChatMessage } from "./chatStore";

export type CallType = "voice" | "video";

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// メッセージの時刻：今日なら「18:02」、それ以前は「9/24 18:02」
export function messageTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export function messagePreview(msg: ChatMessage | undefined, { t }: I18n) {
  if (!msg) return "";
  return msg.kind === "photo" ? t("chat.photoSent") : msg.text;
}
