"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, CalendarDays, MessageCircle } from "lucide-react";

const tabs = [
  { href: "/", label: "タイムライン", icon: Home },
  { href: "/map", label: "マップ", icon: Map },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/chat", label: "チャット", icon: MessageCircle },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
