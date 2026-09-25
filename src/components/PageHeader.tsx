"use client";

import type { MessageKey } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/useI18n";
import LanguageToggle from "@/components/common/LanguageToggle";

type Props = {
  titleKey: MessageKey;
  icon: React.ReactNode;
};

export default function PageHeader({ titleKey, icon }: Props) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      {icon}
      <h1 className="text-lg font-bold text-slate-800">{t(titleKey)}</h1>
      <div className="ml-auto">
        <LanguageToggle />
      </div>
    </header>
  );
}
