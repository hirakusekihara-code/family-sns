import { Phone, PhoneMissed, Video } from "lucide-react";
import { formatDuration, type ChatMessage } from "@/lib/chatData";

type Props = {
  message: ChatMessage;
  isMine: boolean;
  onCallAgain: () => void;
};

// 吹き出し1つ分（テキスト・写真・通話履歴）
export default function MessageBubble({ message, isMine, onCallAgain }: Props) {
  if (message.kind === "photo") {
    return (
      <div
        className={`flex h-48 w-44 items-center justify-center rounded-3xl bg-gradient-to-br text-6xl ${message.gradient}`}
      >
        {message.emoji}
      </div>
    );
  }

  if (message.kind === "call") {
    const duration = message.durationSec;
    const missed = duration === null;
    const Icon = missed ? PhoneMissed : message.callType === "video" ? Video : Phone;
    return (
      <div className="w-52 rounded-3xl bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              missed ? "bg-rose-100 text-rose-500" : "bg-slate-200 text-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {message.callType === "video" ? "ビデオ通話" : "音声通話"}
            </p>
            <p className="text-xs text-slate-500">
              {duration === null ? "応答なし" : formatDuration(duration)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCallAgain}
          className="mt-2 w-full rounded-xl bg-white py-1.5 text-sm font-semibold text-slate-800"
        >
          もう一度かける
        </button>
      </div>
    );
  }

  // 絵文字だけのメッセージは大きく表示（インスタ風）
  const emojiOnly = /^\p{Extended_Pictographic}{1,3}$/u.test(message.text);
  if (emojiOnly) {
    return <p className="text-5xl leading-tight">{message.text}</p>;
  }

  return (
    <p
      className={`max-w-[75vw] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug sm:max-w-72 ${
        isMine
          ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {message.text}
    </p>
  );
}
