import { Home } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/timeline/Timeline";

export default function TimelinePage() {
  return (
    <>
      <PageHeader titleKey="nav.timeline" icon={<Home className="h-5 w-5 text-indigo-600" />} />
      <Timeline />
    </>
  );
}
