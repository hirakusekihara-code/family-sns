"use client";

// チャットのデータ（Supabase に保存。家族がメッセージを送ると自動で届きます）
import { useCallback, useEffect, useState } from "react";
import { describeDbError, refreshPeriodically, supabase } from "@/lib/supabase/client";

// 会話：'group'（家族グループ）または DM 相手のID
export type ConversationId = "group" | (string & {});

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string | null;
  kind: "text" | "photo";
  text: string;
  photo: string | null;
  createdAt: string;
  likedBy: string[];
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  kind: "text" | "photo";
  text: string;
  photo: string | null;
  created_at: string;
  message_likes: { user_id: string }[];
};

const toMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  senderId: r.sender_id,
  recipientId: r.recipient_id,
  kind: r.kind,
  text: r.text,
  photo: r.photo,
  createdAt: r.created_at,
  likedBy: r.message_likes.map((l) => l.user_id),
});

// そのメッセージがどの会話のものか（自分から見て）
export function conversationOf(m: ChatMessage, myId: string): ConversationId {
  if (!m.recipientId) return "group";
  return m.senderId === myId ? m.recipientId : m.senderId;
}

async function fetchChat(familyId: string, myId: string) {
  const [msgRes, readRes] = await Promise.all([
    supabase()
      .from("chat_messages")
      .select("id, sender_id, recipient_id, kind, text, photo, created_at, message_likes(user_id)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<MessageRow[]>(),
    supabase().from("chat_reads").select("conversation, last_read_at").eq("user_id", myId),
  ]);
  return { msgRes, readRes };
}

export function useChat(familyId: string, myId: string) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null); // null = 読み込み中
  const [reads, setReads] = useState<Record<string, string>>({}); // 会話ごとの「最後に読んだ時刻」
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // 数字を増やすと読み込み直す
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // 読み込み
  useEffect(() => {
    let active = true;
    fetchChat(familyId, myId).then(({ msgRes, readRes }) => {
      if (!active) return;
      const err = msgRes.error ?? readRes.error;
      setError(err ? describeDbError(err) : null);
      if (err) return;
      setMessages((msgRes.data ?? []).map(toMessage).reverse());
      setReads(Object.fromEntries((readRes.data ?? []).map((r) => [r.conversation, r.last_read_at])));
    });
    return () => {
      active = false;
    };
  }, [familyId, myId, version]);

  // 家族がメッセージを送ったり ❤️ を付けたりしたら読み込み直す
  useEffect(() => {
    const filter = `family_id=eq.${familyId}`;
    const channel = supabase()
      .channel(`chat-${familyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_likes", filter }, reload)
      .subscribe();
    const stopPolling = refreshPeriodically(reload, 15_000);
    return () => {
      supabase().removeChannel(channel);
      stopPolling();
    };
  }, [familyId, reload]);

  const run = async (op: PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    const { error } = await op;
    if (error) {
      setError(describeDbError(error));
      return false;
    }
    reload();
    return true;
  };

  const recipient = (c: ConversationId) => (c === "group" ? null : c);

  return {
    messages,
    reads,
    error,
    sendText: (c: ConversationId, text: string) =>
      run(supabase().from("chat_messages").insert({ recipient_id: recipient(c), kind: "text", text })),
    sendPhoto: (c: ConversationId, photo: string) =>
      run(supabase().from("chat_messages").insert({ recipient_id: recipient(c), kind: "photo", photo })),
    toggleLike: (messageId: string, liked: boolean) =>
      run(
        liked
          ? supabase().from("message_likes").delete().match({ message_id: messageId, user_id: myId })
          : supabase().from("message_likes").insert({ message_id: messageId }),
      ),
    // 会話を開いたら「ここまで読んだ」を保存
    markRead: async (c: ConversationId) => {
      const at = new Date().toISOString();
      setReads((r) => ({ ...r, [c]: at }));
      await supabase()
        .from("chat_reads")
        .upsert({ user_id: myId, conversation: c, last_read_at: at }, { onConflict: "user_id,conversation" });
    },
  };
}

// 未読の数：相手から届いた、最後に読んだ時刻より新しいメッセージ
export function unreadCount(messages: ChatMessage[], reads: Record<string, string>, c: ConversationId, myId: string) {
  const lastRead = reads[c] ?? "";
  return messages.filter((m) => m.senderId !== myId && conversationOf(m, myId) === c && m.createdAt > lastRead).length;
}
