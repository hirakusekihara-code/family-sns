import { Map } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoon from "@/components/ComingSoon";

export default function MapPage() {
  return (
    <>
      <PageHeader titleKey="nav.map" icon={<Map className="h-5 w-5 text-indigo-600" />} />
      <ComingSoon featureKeys={["soon.map.1", "soon.map.2", "soon.map.3"]} />
    </>
  );
}
