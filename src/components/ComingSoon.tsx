"use client";

import { familyMembers } from "@/lib/mockData";
import type { MessageKey } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  featureKeys: MessageKey[];
};

// 各画面の中身を実装するまでの仮表示
export default function ComingSoon({ featureKeys }: Props) {
  const { t, memberName } = useI18n();
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("soon.members")}</h2>
        <div className="flex gap-4">
          {familyMembers.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${m.color}`}
              >
                {m.emoji}
              </span>
              <span className="text-xs text-slate-600">{memberName(m)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-slate-300 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-500">{t("soon.planned")}</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          {featureKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
