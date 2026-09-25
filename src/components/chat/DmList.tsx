import { Search } from "lucide-react";
import { getMember } from "@/lib/mockData";
import { conversationTitle, messagePreview, type ChatMessage, type Conversation } from "@/lib/chatData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/timeline/Avatar";

type Props = {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  onOpen: (conversationId: string) => void;
};

// インスタのDM一覧風のリスト
export default function DmList({ conversations, messages, onOpen }: Props) {
  const i18n = useI18n();
  const { t, memberName, formatChatTime } = i18n;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-400">
          <Search className="h-4 w-4" />
          <span className="text-sm">{t("chat.search")}</span>
        </div>
      </div>

      {/* オンライン中のメンバー */}
      <div className="flex gap-4 overflow-x-auto px-4 py-4">
        {conversations.map((c) => {
          const member = getMember(c.memberIds[0]);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className="relative rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[2px]">
                <span className="block rounded-full bg-white p-[2px]">
                  <Avatar member={member} size="lg" />
                </span>
                <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
              </span>
              <span className="text-xs text-slate-600">{memberName(member)}</span>
            </button>
          );
        })}
      </div>

      <p className="px-4 pb-1 text-[15px] font-semibold text-slate-900">{t("chat.messages")}</p>
      <ul>
        {conversations.map((c) => {
          const member = getMember(c.memberIds[0]);
          const list = messages[c.id] ?? [];
          const last = list[list.length - 1];
          const unread = c.unread > 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50"
              >
                <Avatar member={member} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] ${unread ? "font-semibold" : ""} text-slate-900`}>
                    {conversationTitle(c, i18n)}
                  </span>
                  <span
                    className={`block truncate text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-500"}`}
                  >
                    {unread && c.unread > 1 ? t("chat.newMessages", { n: c.unread }) : messagePreview(last, i18n)}
                    <span className="font-normal text-slate-400"> · {last && formatChatTime(last.time)}</span>
                  </span>
                </span>
                {unread && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-label={t("chat.unread")} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
