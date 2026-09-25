import { Home } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoon from "@/components/ComingSoon";

export default function TimelinePage() {
  return (
    <>
      <PageHeader title="タイムライン" icon={Home} />
      <ComingSoon
        features={[
          "家族の投稿をスクロールで表示",
          "投稿へのコメント入力・表示",
          "リアクション（いいね・嬉しい・悲しい など）",
        ]}
      />
    </>
  );
}
