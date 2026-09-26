import type { ChatMessage } from "@/lib/chatStore";

type Props = {
  message: ChatMessage;
  isMine: boolean;
};

// 吹き出し1つ分（テキスト・写真）
export default function MessageBubble({ message, isMine }: Props) {
  if (message.kind === "photo" && message.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- データベースに保存した縮小画像を表示するため
      <img src={message.photo} alt="" className="max-h-72 max-w-[65vw] rounded-3xl object-cover sm:max-w-64" />
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
        isMine ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white" : "bg-slate-100 text-slate-900"
      }`}
    >
      {message.text}
    </p>
  );
}
