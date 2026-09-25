import { familyMembers } from "@/lib/mockData";

type Props = {
  features: string[];
};

// 各画面の中身を実装するまでの仮表示
export default function ComingSoon({ features }: Props) {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">家族メンバー</h2>
        <div className="flex gap-4">
          {familyMembers.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${m.color}`}
              >
                {m.emoji}
              </span>
              <span className="text-xs text-slate-600">{m.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-slate-300 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-500">この画面で実装予定の機能</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
