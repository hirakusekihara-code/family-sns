"use client";

import { useState } from "react";
import { createId, currentUserId, initialPosts, type Post, type ReactionType } from "@/lib/mockData";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";

// タイムライン全体。投稿データはこの画面の中だけで保持します（再読み込みで元に戻ります）
export default function Timeline() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  function addPost({ authorId, text, photo }: Pick<Post, "authorId" | "text" | "photo">) {
    const newPost: Post = {
      id: createId("post"),
      authorId,
      text,
      photo,
      minutesAgo: 0,
      reactions: { like: 0, happy: 0, sad: 0 },
      myReactions: [],
      comments: [],
    };
    setPosts((prev) => [newPost, ...prev]); // 新しい投稿を一番上に
  }

  // リアクション：押していなければ +1、押していれば -1（取り消し）
  function toggleReaction(postId: string, type: ReactionType) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const active = p.myReactions.includes(type);
        return {
          ...p,
          reactions: { ...p.reactions, [type]: p.reactions[type] + (active ? -1 : 1) },
          myReactions: active ? p.myReactions.filter((t) => t !== type) : [...p.myReactions, type],
        };
      }),
    );
  }

  function addComment(postId: string, text: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                { id: createId("comment"), authorId: currentUserId, text, minutesAgo: 0 },
              ],
            }
          : p,
      ),
    );
  }

  return (
    <div className="space-y-4 p-4">
      <PostComposer defaultAuthorId={currentUserId} onSubmit={addPost} />
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onToggleReaction={toggleReaction}
          onAddComment={addComment}
        />
      ))}
    </div>
  );
}
