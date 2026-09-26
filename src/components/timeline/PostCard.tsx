"use client";

import { useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { reactionTypes, type ReactionType } from "@/lib/mockData";
import { useFamily } from "@/lib/family";
import { minutesSince, type TimelinePost } from "@/lib/timelineStore";
import { useI18n } from "@/lib/i18n/useI18n";
import MemberAvatar from "@/components/common/MemberAvatar";

type Props = {
  post: TimelinePost;
  now: number;
  onToggleReaction: (postId: string, type: ReactionType, myId: string, active: boolean) => Promise<boolean>;
  onAddComment: (postId: string, text: string) => Promise<boolean>;
  onDelete: (postId: string) => Promise<boolean>;
};

export default function PostCard({ post, now, onToggleReaction, onAddComment, onDelete }: Props) {
  const { t, formatAgo } = useI18n();
  const family = useFamily();
  const [showComments, setShowComments] = useState(post.comments.length > 0);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!family.ready) return null;

  const author = family.member(post.authorId);
  const isMine = post.authorId === family.me.id;

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || busy) return;
    setBusy(true);
    const ok = await onAddComment(post.id, commentText.trim());
    setBusy(false);
    if (ok) setCommentText("");
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* 投稿者 */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <MemberAvatar member={author} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{author.name}</p>
          <p className="text-xs text-slate-400">{formatAgo(minutesSince(post.createdAt, now))}</p>
        </div>
        {isMine && (
          <button
            type="button"
            onClick={() => window.confirm(t("tl.deleteConfirm")) && onDelete(post.id)}
            aria-label={t("tl.deletePost")}
            className="rounded-full p-2 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 本文 */}
      {post.text && (
        <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed text-slate-700">{post.text}</p>
      )}

      {/* 写真 */}
      {post.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- データベースに保存した縮小画像を表示するため
        <img src={post.photo} alt="" className={`w-full object-cover ${post.text ? "" : "mt-3"}`} />
      )}

      {/* リアクションボタン */}
      <div className="flex items-center gap-2 px-4 py-3">
        {reactionTypes.map(({ type, emoji }) => {
          const count = post.reactions.filter((r) => r.type === type).length;
          const active = post.reactions.some((r) => r.type === type && r.userId === family.me.id);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggleReaction(post.id, type, family.me.id, active)}
              aria-pressed={active}
              aria-label={t(`reaction.${type}`)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
                active
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>{emoji}</span>
              <span className="tabular-nums">{count}</span>
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
            const member = family.member(c.authorId);
            return (
              <div key={c.id} className="flex gap-2">
                <MemberAvatar member={member} size="sm" />
                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs font-semibold text-slate-700">
                    {member.name}
                    <span className="ml-2 font-normal text-slate-400">{formatAgo(minutesSince(c.createdAt, now))}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{c.text}</p>
                </div>
              </div>
            );
          })}

          <form onSubmit={handleComment} className="flex items-center gap-2">
            <MemberAvatar member={family.me} size="sm" />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("tl.commentPlaceholder")}
              className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || busy}
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
