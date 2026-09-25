"use client";

import { useState } from "react";
import { createId, currentUserId, photoOptions } from "@/lib/mockData";
import {
  GROUP_ID,
  autoReplies,
  initialConversations,
  initialMessages,
  nowTime,
  pickRandom,
  type CallType,
  type ChatMessage,
  type Conversation,
} from "@/lib/chatData";
import ChatThread from "./ChatThread";
import DmList from "./DmList";
import CallScreen from "./CallScreen";

type Tab = "group" | "dm";
type ActiveCall = { conversationId: string; callType: CallType };

// チャット画面全体。メッセージはこの画面の中だけで保持します（再読み込みで元に戻ります）
export default function ChatApp() {
  const [tab, setTab] = useState<Tab>("group");
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(initialMessages);
  const [openDmId, setOpenDmId] = useState<string | null>(null);
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const [call, setCall] = useState<ActiveCall | null>(null);

  const group = conversations.find((c) => c.id === GROUP_ID)!;
  const dms = conversations.filter((c) => c.type === "dm");
  const openDm = conversations.find((c) => c.id === openDmId);
  const dmUnread = dms.reduce((sum, c) => sum + c.unread, 0);

  function append(conversationId: string, message: ChatMessage) {
    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), message] }));
  }

  // 相手からの自動返信（プロトタイプで「受信」を体験するため）
  function scheduleReply(conversation: Conversation) {
    const memberIds = conversation.memberIds;
    const replierId = pickRandom(memberIds);
    const lines = autoReplies[replierId] ?? ["👍"];
    setTimeout(() => setTyping((t) => ({ ...t, [conversation.id]: replierId })), 600);
    setTimeout(() => {
      setTyping((t) => ({ ...t, [conversation.id]: null }));
      append(conversation.id, {
        id: createId("msg"),
        senderId: replierId,
        time: nowTime(),
        kind: "text",
        text: pickRandom(lines),
      });
    }, 2200);
  }

  function sendText(conversation: Conversation, text: string) {
    append(conversation.id, { id: createId("msg"), senderId: currentUserId, time: nowTime(), kind: "text", text });
    scheduleReply(conversation);
  }

  function sendPhoto(conversation: Conversation) {
    const photo = pickRandom(photoOptions);
    append(conversation.id, { id: createId("msg"), senderId: currentUserId, time: nowTime(), kind: "photo", ...photo });
    scheduleReply(conversation);
  }

  function toggleLike(conversationId: string, messageId: string) {
    setMessages((prev) => ({
      ...prev,
      [conversationId]: prev[conversationId].map((m) => (m.id === messageId ? { ...m, liked: !m.liked } : m)),
    }));
  }

  function openConversation(id: string) {
    setOpenDmId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function endCall(connectedSec: number | null) {
    if (!call) return;
    append(call.conversationId, {
      id: createId("msg"),
      senderId: currentUserId,
      time: nowTime(),
      kind: "call",
      callType: call.callType,
      durationSec: connectedSec,
    });
    setCall(null);
  }

  function renderThread(conversation: Conversation, onBack?: () => void) {
    return (
      <ChatThread
        conversation={conversation}
        messages={messages[conversation.id] ?? []}
        typingMemberId={typing[conversation.id] ?? null}
        onSendText={(text) => sendText(conversation, text)}
        onSendPhoto={() => sendPhoto(conversation)}
        onToggleLike={(id) => toggleLike(conversation.id, id)}
        onCall={(callType) => setCall({ conversationId: conversation.id, callType })}
        onBack={onBack}
      />
    );
  }

  const callConversation = call && conversations.find((c) => c.id === call.conversationId);

  return (
    <>
      {/* ボトムナビ（高さ 4rem）の上までを画面いっぱいに使う */}
      <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] mx-auto flex max-w-md flex-col bg-white">
        <header className="border-b border-slate-100">
          <h1 className="px-4 pt-3 text-xl font-bold text-slate-900">チャット</h1>
          <div className="mt-2 grid grid-cols-2">
            {(
              [
                { id: "group", label: "家族グループ", badge: 0 },
                { id: "dm", label: "DM", badge: dmUnread },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex items-center justify-center gap-1.5 pb-2.5 pt-1 text-[15px] font-semibold transition ${
                  tab === t.id ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{t.badge}</span>
                )}
                {tab === t.id && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-slate-900" />}
              </button>
            ))}
          </div>
        </header>

        {tab === "group" ? renderThread(group) : <DmList conversations={dms} messages={messages} onOpen={openConversation} />}
      </div>

      {/* 以下の全画面表示はボトムナビより手前に出すため、上の枠の外に置いています */}

      {/* DMのトーク画面：インスタのように全画面で開く（ボトムナビも隠れる） */}
      {openDm && (
        <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-white pb-[env(safe-area-inset-bottom)]">
          {renderThread(openDm, () => setOpenDmId(null))}
        </div>
      )}

      {call && callConversation && (
        <CallScreen
          callType={call.callType}
          title={callConversation.title}
          memberIds={callConversation.memberIds}
          onEnd={endCall}
        />
      )}
    </>
  );
}
