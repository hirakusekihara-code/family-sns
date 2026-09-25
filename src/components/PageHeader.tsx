import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  icon: LucideIcon;
};

export default function PageHeader({ title, icon: Icon }: Props) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <Icon className="h-5 w-5 text-indigo-600" />
      <h1 className="text-lg font-bold text-slate-800">{title}</h1>
    </header>
  );
}
