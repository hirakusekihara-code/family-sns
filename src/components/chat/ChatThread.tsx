"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, Phone, Video } from "lucide-react";
import type { Member } from "@/lib/family";
import type { ChatMessage } from "@/lib/chatStore";
import { messageTime, type CallType } from "@/lib/chatData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

type Props = {
  title: string;
  isGroup: boolean;
  members: Member[]; // 自分以外の参加者
  me: Member;
  member: (id: string) => Member;
  messages: ChatMessage[];
  emptyText: string;
  onSendText: (text: string) => Promise<boolean>;
  onSendPhoto: (photo: string) => Promise<boolean>;
  onToggleLike: (messageId: string, liked: boolean) => void;
  onCall: (type: CallType) => void;
  onBack?: () => void; // DMのときだけ「戻る」ボタンを出す
};

const GAP_FOR_TIME_MS = 15 * 60 * 1000; // 15分以上あいたら時刻を表示

export default function ChatThread({
  title,
  isGroup,
  members,
  me,
  member,
  messages,
  emptyText,
  onSendText,
  onSendPhoto,
  onToggleLike,
  onCall,
  onBack,
}: Props) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら一番下までスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* トークのヘッダー：相手の名前と通話ボタン */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label={t("chat.back")} className="-ml-1 p-1">
            <ChevronLeft className="h-7 w-7 text-slate-800" />
          </button>
        )}
        {isGroup && members.length > 0 ? (
          <div className="relative h-11 w-11 shrink-0">
            <span className="absolute left-0 top-0">
              <Avatar member={me} size="sm" />
            </span>
            <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-white">
              <Avatar member={members[0]} size="sm" />
            </span>
          </div>
        ) : (
          <Avatar member={members[0] ?? me} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{title}</p>
          {isGroup && <p className="truncate text-xs text-slate-500">{t("chat.members", { n: members.length + 1 })}</p>}
        </div>
        {members.length > 0 && (
          <>
            <button type="button" onClick={() => onCall("voice")} aria-label={t("chat.voiceCall")} className="p-2">
              <Phone className="h-6 w-6 text-slate-800" />
            </button>
            <button type="button" onClick={() => onCall("video")} aria-label={t("chat.videoCall")} className="p-2">
              <Video className="h-7 w-7 text-slate-800" />
            </button>
          </>
        )}
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && <p className="mt-10 px-6 text-center text-sm text-slate-400">{emptyText}</p>}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isMine = msg.senderId === me.id;
          const sender = member(msg.senderId);
          const showTime = !prev || Date.parse(msg.createdAt) - Date.parse(prev.createdAt) > GAP_FOR_TIME_MS;
          const isFirstOfRun = !prev || prev.senderId !== msg.senderId || showTime;
          const nextShowsTime = next && Date.parse(next.createdAt) - Date.parse(msg.createdAt) > GAP_FOR_TIME_MS;
          const isLastOfRun = !next || next.senderId !== msg.senderId || nextShowsTime;
          const liked = msg.likedBy.includes(me.id);

          return (
            <div key={msg.id}>
              {showTime && <p className="my-3 text-center text-xs text-slate-400">{messageTime(msg.createdAt)}</p>}
              {isGroup && !isMine && isFirstOfRun && <p className="mb-0.5 ml-12 text-xs text-slate-500">{sender.name}</p>}
              <div className={`mb-1 flex items-end gap-2 ${isMine ? "justify-end" : ""}`}>
                {!isMine && (
                  <span className={`w-8 ${isLastOfRun ? "" : "invisible"}`}>
                    <Avatar member={sender} size="sm" />
                  </span>
                )}
                {/* ダブルタップ（ダブルクリック）で ❤️ */}
                <div className="relative select-none" onDoubleClick={() => onToggleLike(msg.id, liked)}>
                  <MessageBubble message={msg} isMine={isMine} />
                  {msg.likedBy.length > 0 && (
                    <span
                      className={`absolute -bottom-3 rounded-full bg-white px-1 text-xs shadow ${isMine ? "right-2" : "left-2"}`}
                    >
                      ❤️{msg.likedBy.length > 1 ? msg.likedBy.length : ""}
                    </span>
                  )}
                </div>
              </div>
              {msg.likedBy.length > 0 && <div className="h-3" />}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageComposer onSendText={onSendText} onSendPhoto={onSendPhoto} />
    </div>
  );
}
