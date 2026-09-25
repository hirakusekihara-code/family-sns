"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, Phone, Video } from "lucide-react";
import { currentUserId, getMember } from "@/lib/mockData";
import type { CallType, ChatMessage, Conversation } from "@/lib/chatData";
import Avatar from "@/components/timeline/Avatar";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

type Props = {
  conversation: Conversation;
  messages: ChatMessage[];
  typingMemberId: string | null;
  onSendText: (text: string) => void;
  onSendPhoto: () => void;
  onToggleLike: (messageId: string) => void;
  onCall: (type: CallType) => void;
  onBack?: () => void; // DMのときだけ「戻る」ボタンを出す
};

export default function ChatThread({
  conversation,
  messages,
  typingMemberId,
  onSendText,
  onSendPhoto,
  onToggleLike,
  onCall,
  onBack,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isGroup = conversation.type === "group";
  const members = conversation.memberIds.map(getMember);

  // 新しいメッセージが来たら一番下までスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typingMemberId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* トークのヘッダー：相手の名前と通話ボタン */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="戻る" className="-ml-1 p-1">
            <ChevronLeft className="h-7 w-7 text-slate-800" />
          </button>
        )}
        {isGroup ? (
          <div className="relative h-11 w-11 shrink-0">
            <span className="absolute left-0 top-0">
              <Avatar member={members[0]} size="sm" />
            </span>
            <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-white">
              <Avatar member={members[1]} size="sm" />
            </span>
          </div>
        ) : (
          <Avatar member={members[0]} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{conversation.title}</p>
          <p className="truncate text-xs text-slate-500">
            {isGroup ? `${members.length + 1}人のメンバー` : "オンライン"}
          </p>
        </div>
        <button type="button" onClick={() => onCall("voice")} aria-label="音声通話" className="p-2">
          <Phone className="h-6 w-6 text-slate-800" />
        </button>
        <button type="button" onClick={() => onCall("video")} aria-label="ビデオ通話" className="p-2">
          <Video className="h-7 w-7 text-slate-800" />
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isMine = msg.senderId === currentUserId;
          const sender = getMember(msg.senderId);
          const showTime = !prev || prev.time !== msg.time;
          const isFirstOfRun = !prev || prev.senderId !== msg.senderId || showTime;
          const isLastOfRun = !next || next.senderId !== msg.senderId || next.time !== msg.time;

          return (
            <div key={msg.id}>
              {showTime && <p className="my-3 text-center text-xs text-slate-400">{msg.time}</p>}
              {isGroup && !isMine && isFirstOfRun && (
                <p className="mb-0.5 ml-12 text-xs text-slate-500">{sender.name}</p>
              )}
              <div className={`mb-1 flex items-end gap-2 ${isMine ? "justify-end" : ""}`}>
                {!isMine && (
                  <span className={`w-8 ${isLastOfRun ? "" : "invisible"}`}>
                    <Avatar member={sender} size="sm" />
                  </span>
                )}
                {/* ダブルタップ（ダブルクリック）で ❤️ */}
                <div className="relative select-none" onDoubleClick={() => onToggleLike(msg.id)}>
                  <MessageBubble
                    message={msg}
                    isMine={isMine}
                    onCallAgain={() => msg.kind === "call" && onCall(msg.callType)}
                  />
                  {msg.liked && (
                    <span
                      className={`absolute -bottom-3 rounded-full bg-white px-1 text-xs shadow ${
                        isMine ? "right-2" : "left-2"
                      }`}
                    >
                      ❤️
                    </span>
                  )}
                </div>
              </div>
              {msg.liked && <div className="h-3" />}
            </div>
          );
        })}

        {typingMemberId && (
          <div className="mb-1 flex items-end gap-2">
            <Avatar member={getMember(typingMemberId)} size="sm" />
            <div className="flex gap-1 rounded-3xl bg-slate-100 px-4 py-3" aria-label="入力中">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <MessageComposer onSendText={onSendText} onSendPhoto={onSendPhoto} />
    </div>
  );
}
