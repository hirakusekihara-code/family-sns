"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, CalendarDays, MessageCircle, CircleUser } from "lucide-react";
import { useI18n } from "@/lib/i18n/useI18n";

const tabs = [
  { href: "/", labelKey: "nav.timeline", icon: Home },
  { href: "/map", labelKey: "nav.map", icon: Map },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/chat", labelKey: "nav.chat", icon: MessageCircle },
  { href: "/profile", labelKey: "nav.me", icon: CircleUser },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, labelKey, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
