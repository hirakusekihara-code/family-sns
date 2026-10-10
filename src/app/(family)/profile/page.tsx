import { CircleUser } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ProfileApp from "@/components/profile/ProfileApp";

export default function ProfilePage() {
  return (
    <>
      <PageHeader titleKey="nav.me" icon={<CircleUser className="h-5 w-5 text-indigo-600" />} />
      <ProfileApp />
    </>
  );
}
