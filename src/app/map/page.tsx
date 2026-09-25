import { Map } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MapLoader from "@/components/map/MapLoader";

export default function MapPage() {
  return (
    <>
      <PageHeader titleKey="nav.map" icon={<Map className="h-5 w-5 text-indigo-600" />} />
      <MapLoader />
    </>
  );
}
