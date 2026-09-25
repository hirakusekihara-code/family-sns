"use client";

import { ArrowDownRight, ArrowUpRight, FileDown, Paperclip } from "lucide-react";
import { getMember } from "@/lib/mockData";
import {
  formatYen,
  getLedger,
  inMonth,
  sumBy,
  toDateKey,
  transactionsOf,
  visibleLedgers,
  type CalendarEvent,
  type YearMonth,
} from "@/lib/calendarData";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  events: CalendarEvent[];
  viewerId: string;
  cursor: YearMonth;
  ledgerId: string;
  onLedgerChange: (id: string) => void;
  onOpen: (event: CalendarEvent) => void;
  onExportPl: () => void;
};

// 家計簿：帳簿ごとの月の収支・内訳・明細
export default function MoneyView({ events, viewerId, cursor, ledgerId, onLedgerChange, onOpen, onExportPl }: Props) {
  const { t, memberName, categoryLabel, ledgerName, formatDate } = useI18n();
  const ledger = getLedger(ledgerId);
  const options = visibleLedgers(viewerId);
  const isChildViewer = getMember(viewerId).role === "child";

  const all = transactionsOf(events, ledger.id);
  const monthly = inMonth(all, cursor).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const income = sumBy(monthly, "income");
  const expense = sumBy(monthly, "expense");

  // 月末時点の残高（お小遣い帳で表示）
  const monthEnd = toDateKey(new Date(cursor.year, cursor.month + 1, 0));
  const upToMonthEnd = all.filter((tx) => tx.date <= monthEnd);
  const balance = ledger.initialBalance + sumBy(upToMonthEnd, "income") - sumBy(upToMonthEnd, "expense");

  // 支出の内訳（多い順）
  const byCategory = new Map<string, number>();
  monthly
    .filter((tx) => tx.money.type === "expense")
    .forEach((tx) => byCategory.set(tx.money.category, (byCategory.get(tx.money.category) ?? 0) + tx.money.amount));
  const breakdown = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCategory = breakdown[0]?.[1] ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* 帳簿の切り替え */}
      <div className="flex gap-2 overflow-x-auto">
        {options.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onLedgerChange(l.id)}
            aria-pressed={l.id === ledger.id}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              l.id === ledger.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {l.emoji} {ledgerName(l)}
          </button>
        ))}
      </div>
      {isChildViewer && <p className="text-xs text-slate-500">{t("mv.childNote")}</p>}

      {/* サマリー */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {ledger.ownerId && (
          <div className="mb-4">
            <p className="text-xs text-slate-500">{t("mv.balance", { date: formatDate(monthEnd) })}</p>
            <p className="text-5xl font-semibold tracking-tight text-slate-900">{formatYen(balance)}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t("mv.income")} value={formatYen(income)} icon="up" />
          <StatTile label={t("mv.expense")} value={formatYen(expense)} icon="down" />
          {!ledger.ownerId && (
            <div className="col-span-2">
              <StatTile label={t("mv.net")} value={`${income - expense < 0 ? "−" : ""}${formatYen(Math.abs(income - expense))}`} />
            </div>
          )}
        </div>
      </section>

      {/* 支出の内訳 */}
      {breakdown.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{t("mv.breakdown")}</h2>
          <ul className="space-y-2.5">
            {breakdown.map(([category, amount]) => {
              const share = Math.round((amount / expense) * 100);
              return (
                <li key={category} title={`${categoryLabel(category)}: ${formatYen(amount)} (${share}%)`}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">{categoryLabel(category)}</span>
                    <span className="text-slate-900 tabular-nums">
                      {formatYen(amount)} <span className="text-xs text-slate-400">{share}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-indigo-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(amount / maxCategory) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 明細 */}
      <section className="rounded-2xl bg-white shadow-sm">
        <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-slate-900">{t("mv.transactions")}</h2>
        {monthly.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-slate-400">{t("mv.noRecords")}</p>
        ) : (
          <ul>
            {monthly.map((tx) => {
              const [, m, d] = tx.date.split("-").map(Number);
              const isExpense = tx.money.type === "expense";
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(tx)}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left first:border-t-0 active:bg-slate-50"
                  >
                    <span className="w-10 shrink-0 text-xs text-slate-500 tabular-nums">
                      {m}/{d}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{tx.title}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        {categoryLabel(tx.money.category)} · {memberName(getMember(tx.assigneeId))}
                        {tx.attachments.length > 0 && (
                          <>
                            <Paperclip className="ml-1 h-3 w-3" aria-hidden />
                            {tx.attachments.length}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 tabular-nums">
                      {isExpense ? (
                        <ArrowDownRight className="h-4 w-4 text-rose-500" aria-label={t("money.expense")} />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-emerald-600" aria-label={t("money.income")} />
                      )}
                      {isExpense ? "−" : "+"}
                      {formatYen(tx.money.amount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={onExportPl}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white py-3 text-sm font-semibold text-indigo-700 shadow-sm active:scale-[0.99]"
      >
        <FileDown className="h-5 w-5" />
        {t("mv.exportPl")}
      </button>
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon?: "up" | "down" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="flex items-center gap-1 text-xs text-slate-500">
        {icon === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
        {icon === "down" && <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" aria-hidden />}
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
