import { Home } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/timeline/Timeline";

export default function TimelinePage() {
  return (
    <>
      <PageHeader title="タイムライン" icon={Home} />
      <Timeline />
    </>
  );
}
