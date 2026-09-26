"use client";

// タイムラインのデータ（Supabase に保存。家族が投稿すると自動で最新になります）
import { useCallback, useEffect, useState } from "react";
import { describeDbError, refreshPeriodically, supabase } from "@/lib/supabase/client";
import type { ReactionType } from "@/lib/mockData";

export type TimelineComment = { id: string; authorId: string; text: string; createdAt: string };
export type TimelinePost = {
  id: string;
  authorId: string;
  text: string;
  photo: string | null;
  createdAt: string;
  comments: TimelineComment[];
  reactions: { userId: string; type: ReactionType }[];
};

type PostRow = {
  id: string;
  author_id: string;
  text: string;
  photo: string | null;
  created_at: string;
  post_comments: { id: string; author_id: string; text: string; created_at: string }[];
  post_reactions: { user_id: string; type: ReactionType }[];
};

const toPost = (r: PostRow): TimelinePost => ({
  id: r.id,
  authorId: r.author_id,
  text: r.text,
  photo: r.photo,
  createdAt: r.created_at,
  comments: [...r.post_comments]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => ({ id: c.id, authorId: c.author_id, text: c.text, createdAt: c.created_at })),
  reactions: r.post_reactions.map((x) => ({ userId: x.user_id, type: x.type })),
});

async function fetchPosts(familyId: string) {
  return supabase()
    .from("posts")
    .select("id, author_id, text, photo, created_at, post_comments(id, author_id, text, created_at), post_reactions(user_id, type)")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<PostRow[]>();
}

export function useTimeline(familyId: string) {
  const [posts, setPosts] = useState<TimelinePost[] | null>(null); // null = 読み込み中
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // 数字を増やすと読み込み直す
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // 読み込み
  useEffect(() => {
    let active = true;
    fetchPosts(familyId).then(({ data, error }) => {
      if (!active) return;
      setError(error ? describeDbError(error) : null);
      if (!error) setPosts((data ?? []).map(toPost));
    });
    return () => {
      active = false;
    };
  }, [familyId, version]);

  // 家族の誰かが投稿・コメント・リアクションしたら読み込み直す
  useEffect(() => {
    const filter = `family_id=eq.${familyId}`;
    const channel = supabase()
      .channel(`timeline-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions", filter }, reload)
      .subscribe();
    const stopPolling = refreshPeriodically(reload, 60_000);
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

  return {
    posts,
    error,
    createPost: (text: string, photo: string | null) => run(supabase().from("posts").insert({ text, photo })),
    deletePost: (postId: string) => run(supabase().from("posts").delete().eq("id", postId)),
    addComment: (postId: string, text: string) => run(supabase().from("post_comments").insert({ post_id: postId, text })),
    toggleReaction: (postId: string, type: ReactionType, myId: string, active: boolean) =>
      run(
        active
          ? supabase().from("post_reactions").delete().match({ post_id: postId, user_id: myId, type })
          : supabase().from("post_reactions").insert({ post_id: postId, type }),
      ),
  };
}

// 経過時間（分）
export const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
