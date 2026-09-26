"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/lib/family";
import { conversationOf, unreadCount, useChat, type ConversationId } from "@/lib/chatStore";
import type { CallType } from "@/lib/chatData";
import { useI18n } from "@/lib/i18n/useI18n";
import { SETUP_NEEDED } from "@/lib/supabase/client";
import LanguageToggle from "@/components/common/LanguageToggle";
import ChatThread from "./ChatThread";
import DmList from "./DmList";
import CallScreen from "./CallScreen";

type Tab = "group" | "dm";
type ActiveCall = { conversation: ConversationId; callType: CallType };

// チャット画面全体。メッセージは Supabase に保存され、家族の画面にもすぐ届きます
export default function ChatApp() {
  const family = useFamily();
  if (!family.ready) return null;
  return <ChatInner familyId={family.family.id} myId={family.me.id} />;
}

function ChatInner({ familyId, myId }: { familyId: string; myId: string }) {
  const { t } = useI18n();
  const family = useFamily();
  const chat = useChat(familyId, myId);
  const [tab, setTab] = useState<Tab>("group");
  const [openDm, setOpenDm] = useState<string | null>(null);
  const [call, setCall] = useState<ActiveCall | null>(null);

  // 今見ている会話（家族グループのタブ、または開いているDM）
  const viewing: ConversationId | null = openDm ?? (tab === "group" ? "group" : null);
  const messages = chat.messages ?? [];
  const latestInView = viewing ? messages.filter((m) => conversationOf(m, myId) === viewing).at(-1)?.id : undefined;
  const { markRead } = chat;

  // 会話を開いている間は、届いたメッセージを既読にする
  useEffect(() => {
    if (viewing) markRead(viewing);
    // markRead は毎回作り直されるので、会話と最新メッセージが変わったときだけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing, latestInView]);

  if (!family.ready) return null;
  const { me, others, member } = family;

  const dmUnread = others.reduce((sum, m) => sum + unreadCount(messages, chat.reads, m.id, myId), 0);
  const groupUnread = unreadCount(messages, chat.reads, "group", myId);

  function renderThread(c: ConversationId, onBack?: () => void) {
    const isGroup = c === "group";
    const partner = isGroup ? null : member(c);
    return (
      <ChatThread
        title={isGroup ? t("chat.groupName") : partner!.name}
        isGroup={isGroup}
        members={isGroup ? others : [partner!]}
        me={me}
        member={member}
        messages={messages.filter((m) => conversationOf(m, myId) === c)}
        emptyText={isGroup ? t("chat.emptyGroup") : t("chat.emptyDm", { name: partner!.name })}
        onSendText={(text) => chat.sendText(c, text)}
        onSendPhoto={(photo) => chat.sendPhoto(c, photo)}
        onToggleLike={chat.toggleLike}
        onCall={(callType) => setCall({ conversation: c, callType })}
        onBack={onBack}
      />
    );
  }

  return (
    <>
      {/* ボトムナビ（高さ 4rem）の上までを画面いっぱいに使う */}
      <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] mx-auto flex max-w-md flex-col bg-white">
        <header className="border-b border-slate-100">
          <div className="flex items-center justify-between px-4 pt-3">
            <h1 className="text-xl font-bold text-slate-900">{t("chat.title")}</h1>
            <LanguageToggle />
          </div>
          <div className="mt-2 grid grid-cols-2">
            {(
              [
                { id: "group", label: t("chat.tab.group"), badge: tab === "group" ? 0 : groupUnread },
                { id: "dm", label: t("chat.tab.dm"), badge: dmUnread },
              ] as const
            ).map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setTab(x.id)}
                className={`relative flex items-center justify-center gap-1.5 pb-2.5 pt-1 text-[15px] font-semibold transition ${
                  tab === x.id ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {x.label}
                {x.badge > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{x.badge}</span>
                )}
                {tab === x.id && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-slate-900" />}
              </button>
            ))}
          </div>
        </header>

        {chat.error && (
          <p className="bg-rose-50 px-4 py-2 text-xs text-rose-700" role="alert">
            {chat.error === SETUP_NEEDED ? t("setup.tablesMissing") : chat.error}
          </p>
        )}

        {chat.messages === null ? (
          <p className="flex-1 pt-10 text-center text-sm text-slate-400">{t("common.loading")}</p>
        ) : tab === "group" ? (
          renderThread("group")
        ) : (
          <DmList others={others} myId={myId} messages={messages} reads={chat.reads} onOpen={setOpenDm} />
        )}
      </div>

      {/* 以下の全画面表示はボトムナビより手前に出すため、上の枠の外に置いています */}

      {/* DMのトーク画面：インスタのように全画面で開く（ボトムナビも隠れる） */}
      {openDm && (
        <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-white pb-[env(safe-area-inset-bottom)]">
          {renderThread(openDm, () => setOpenDm(null))}
        </div>
      )}

      {call && (
        <CallScreen
          callType={call.callType}
          title={call.conversation === "group" ? t("chat.groupName") : member(call.conversation).name}
          members={call.conversation === "group" ? others : [member(call.conversation)]}
          me={me}
          onEnd={() => setCall(null)}
        />
      )}
    </>
  );
}
