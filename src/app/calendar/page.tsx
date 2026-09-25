import { CalendarDays } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoon from "@/components/ComingSoon";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="カレンダー" icon={CalendarDays} />
      <ComingSoon
        features={[
          "月間／週間カレンダー",
          "家族ごとの色分け表示",
          "「全員表示」「自分のみ表示」フィルター",
          "家族全員の予定の新規登録・編集",
        ]}
      />
    </>
  );
}
