import { Map } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoon from "@/components/ComingSoon";

export default function MapPage() {
  return (
    <>
      <PageHeader title="マップ" icon={Map} />
      <ComingSoon
        features={[
          "簡易的な地図UI",
          "家族メンバーの現在地アイコン",
          "学校・職場などのスポットと本日の予定のポップアップ",
        ]}
      />
    </>
  );
}
