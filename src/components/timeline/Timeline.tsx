"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/lib/family";
import { useTimeline } from "@/lib/timelineStore";
import { useI18n } from "@/lib/i18n/useI18n";
import { SETUP_NEEDED } from "@/lib/supabase/client";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";

// タイムライン全体。投稿は Supabase に保存され、家族全員に共有されます
export default function Timeline() {
  const family = useFamily();
  if (!family.ready) return null;
  return <TimelineInner familyId={family.family.id} />;
}

function TimelineInner({ familyId }: { familyId: string }) {
  const { t } = useI18n();
  const timeline = useTimeline(familyId);
  const now = useNow();

  return (
    <div className="space-y-4 p-4">
      <PostComposer onSubmit={timeline.createPost} />
      {timeline.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {timeline.error === SETUP_NEEDED ? t("setup.tablesMissing") : timeline.error}
        </p>
      )}
      {timeline.posts === null ? (
        <p className="py-8 text-center text-sm text-slate-400">{t("common.loading")}</p>
      ) : timeline.posts.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {t("tl.empty")}
        </p>
      ) : (
        timeline.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            now={now}
            onToggleReaction={timeline.toggleReaction}
            onAddComment={timeline.addComment}
            onDelete={timeline.deletePost}
          />
        ))
      )}
    </div>
  );
}

// 「◯分前」の表示を1分ごとに更新するための現在時刻
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
