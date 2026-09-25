"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { getMember, reactionTypes, type Post, type ReactionType } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "./Avatar";

type Props = {
  post: Post;
  currentUserId: string;
  onToggleReaction: (postId: string, type: ReactionType) => void;
  onAddComment: (postId: string, text: string) => void;
};

export default function PostCard({ post, currentUserId, onToggleReaction, onAddComment }: Props) {
  const { t, memberName, formatAgo } = useI18n();
  const [showComments, setShowComments] = useState(post.comments.length > 0);
  const [commentText, setCommentText] = useState("");
  const author = getMember(post.authorId);

  function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText.trim());
    setCommentText("");
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* 投稿者 */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar member={author} />
        <div>
          <p className="text-sm font-semibold text-slate-800">{memberName(author)}</p>
          <p className="text-xs text-slate-400">{formatAgo(post.minutesAgo)}</p>
        </div>
      </div>

      {/* 本文 */}
      <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed text-slate-700">{post.text}</p>

      {/* 写真（ダミー） */}
      {post.photo && (
        <div className={`flex h-56 items-center justify-center bg-gradient-to-br text-7xl ${post.photo.gradient}`}>
          {post.photo.emoji}
        </div>
      )}

      {/* リアクションボタン */}
      <div className="flex items-center gap-2 px-4 py-3">
        {reactionTypes.map(({ type, emoji }) => {
          const active = post.myReactions.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggleReaction(post.id, type)}
              aria-pressed={active}
              aria-label={t(`reaction.${type}`)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
                active
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>{emoji}</span>
              <span className="tabular-nums">{post.reactions[type]}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments.length}
        </button>
      </div>

      {/* コメント */}
      {showComments && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
          {post.comments.map((c) => {
            const member = getMember(c.authorId);
            return (
              <div key={c.id} className="flex gap-2">
                <Avatar member={member} size="sm" />
                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-semibold text-slate-700">
                    {memberName(member)}
                    <span className="ml-2 font-normal text-slate-400">{formatAgo(c.minutesAgo)}</span>
                  </p>
                  <p className="text-sm text-slate-700">{c.text}</p>
                </div>
              </div>
            );
          })}

          <form onSubmit={handleComment} className="flex items-center gap-2">
            <Avatar member={getMember(currentUserId)} size="sm" />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("tl.commentPlaceholder")}
              className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="rounded-full bg-indigo-600 p-2 text-white disabled:bg-slate-300"
              aria-label={t("tl.sendComment")}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
