import { MessageCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoon from "@/components/ComingSoon";

export default function ChatPage() {
  return (
    <>
      <PageHeader title="チャット" icon={MessageCircle} />
      <ComingSoon
        features={[
          "「家族グループ」と「個別DM」のタブ切り替え",
          "簡易的なメッセージ送受信",
        ]}
      />
    </>
  );
}
