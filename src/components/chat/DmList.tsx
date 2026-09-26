import { Search } from "lucide-react";
import type { Member } from "@/lib/family";
import { conversationOf, unreadCount, type ChatMessage } from "@/lib/chatStore";
import { messagePreview, messageTime } from "@/lib/chatData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";

type Props = {
  others: Member[];
  myId: string;
  messages: ChatMessage[];
  reads: Record<string, string>;
  onOpen: (memberId: string) => void;
};

// インスタのDM一覧風のリスト（相手ごとに1行）
export default function DmList({ others, myId, messages, reads, onOpen }: Props) {
  const i18n = useI18n();
  const { t } = i18n;

  if (others.length === 0) {
    return <p className="flex-1 px-8 pt-16 text-center text-sm text-slate-500">{t("chat.noMembers")}</p>;
  }

  // 最近やり取りした相手を上に
  const rows = others
    .map((m) => {
      const list = messages.filter((x) => x.recipientId && conversationOf(x, myId) === m.id);
      return { member: m, last: list[list.length - 1], unread: unreadCount(messages, reads, m.id, myId) };
    })
    .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-400">
          <Search className="h-4 w-4" />
          <span className="text-sm">{t("chat.search")}</span>
        </div>
      </div>

      {/* 家族のアイコン */}
      <div className="flex gap-4 overflow-x-auto px-4 py-4">
        {others.map((m) => (
          <button key={m.id} type="button" onClick={() => onOpen(m.id)} className="flex shrink-0 flex-col items-center gap-1">
            <span className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[2px]">
              <span className="block rounded-full bg-white p-[2px]">
                <Avatar member={m} size="lg" />
              </span>
            </span>
            <span className="max-w-16 truncate text-xs text-slate-600">{m.name}</span>
          </button>
        ))}
      </div>

      <p className="px-4 pb-1 text-[15px] font-semibold text-slate-900">{t("chat.messages")}</p>
      <ul>
        {rows.map(({ member, last, unread }) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => onOpen(member.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50"
            >
              <Avatar member={member} size="lg" />
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] ${unread ? "font-semibold" : ""} text-slate-900`}>{member.name}</span>
                <span className={`block truncate text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                  {unread > 1 ? t("chat.newMessages", { n: unread }) : messagePreview(last, i18n)}
                  {last && <span className="font-normal text-slate-400"> · {messageTime(last.createdAt)}</span>}
                </span>
              </span>
              {unread > 0 && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-label={t("chat.unread")} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
