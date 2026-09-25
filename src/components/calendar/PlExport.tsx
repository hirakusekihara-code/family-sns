"use client";

import { useRef, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";
import { getMember } from "@/lib/mockData";
import {
  categories,
  getLedger,
  monthKey,
  monthsBetween,
  shiftMonth,
  sumBy,
  toDateKey,
  transactionsOf,
  visibleLedgers,
  type CalendarEvent,
  type MoneyType,
  type Transaction,
  type YearMonth,
} from "@/lib/calendarData";
import { useI18n, type I18n } from "@/lib/i18n/useI18n";

type Props = {
  events: CalendarEvent[];
  viewerId: string;
  initialLedgerId: string;
  initialMonth: YearMonth;
  onClose: () => void;
};

const MAX_MONTHS = 12;
const A4 = { portrait: { width: 794, height: 1123 }, landscape: { width: 1123, height: 794 } }; // 96dpi のA4（px）

function parseMonthInput(value: string): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}

// PL（収支報告書）の出力：期間を選んで、月ごとの収支表をPDFで保存
export default function PlExport({ events, viewerId, initialLedgerId, initialMonth, onClose }: Props) {
  const i18n = useI18n();
  const { t, ledgerName, memberName, formatDate } = i18n;
  const [ledgerId, setLedgerId] = useState(initialLedgerId);
  const [from, setFrom] = useState<YearMonth>(() => shiftMonth(initialMonth, -1)); // 初期値：前月〜表示中の月
  const [to, setTo] = useState<YearMonth>(initialMonth);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewWidth] = useState(() => Math.min(window.innerWidth, 448) - 32);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const rangeInvalid = monthKey(to) < monthKey(from);
  const months = rangeInvalid ? [] : monthsBetween(from, to);
  const tooLong = !rangeInvalid && monthKey(shiftMonth(from, MAX_MONTHS - 1)) < monthKey(to);
  const canExport = !rangeInvalid && !tooLong && months.length > 0;

  const ledger = getLedger(ledgerId);
  const orientation = months.length > 6 ? "landscape" : "portrait";
  const size = A4[orientation];
  const scale = previewWidth / size.width;

  const start = `${monthKey(from)}-01`;
  const end = toDateKey(new Date(to.year, to.month + 1, 0));
  const all = transactionsOf(events, ledger.id);
  const inRange = all.filter((tx) => tx.date >= start && tx.date <= end).sort((a, b) => (a.date < b.date ? -1 : 1));

  const rowsPerPage = orientation === "portrait" ? 30 : 17;
  const detailPages = includeDetails ? chunk(inRange, rowsPerPage) : [];
  const pageCount = 1 + detailPages.length;

  const periodLabel = `${monthLabel(from, i18n, true)} 〜 ${monthLabel(to, i18n, true)}`;
  const meta = {
    title: t("pl.title"),
    ledger: `${ledger.emoji} ${ledgerName(ledger)}`,
    period: periodLabel,
    createdAt: formatDate(toDateKey(new Date())),
    createdBy: memberName(getMember(viewerId)),
  };

  async function download() {
    setGenerating(true);
    setError(null);
    try {
      // PDF作成のライブラリは、ボタンを押したときに読み込む
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageCount; i++) {
        const node = pageRefs.current[i];
        if (!node) continue;
        // 画面の文字をそのまま画像（JPEG）にしてPDFに貼るので、日本語も崩れません
        const image = await toJpeg(node, {
          pixelRatio: 2,
          quality: 0.92,
          backgroundColor: "#ffffff",
          width: size.width,
          height: size.height,
        });
        if (i > 0) pdf.addPage("a4", orientation);
        pdf.addImage(image, "JPEG", 0, 0, pw, ph);
      }
      pdf.save(`PL_${ledger.id}_${monthKey(from)}_${monthKey(to)}.pdf`);
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  const ledgerOptions = visibleLedgers(viewerId);

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-slate-100">
      <div className="flex items-center gap-2 bg-white px-2 py-2 shadow-sm">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-slate-100">
          <X className="h-6 w-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-lg font-semibold text-slate-900">{t("pl.dialogTitle")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 出力の設定 */}
        <div className="space-y-3 bg-white px-4 pb-4 pt-2">
          <label className="block text-xs text-slate-500">
            {t("pl.ledger")}
            <select
              value={ledgerId}
              onChange={(e) => setLedgerId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
            >
              {ledgerOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.emoji} {ledgerName(l)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              {t("pl.from")}
              <input
                type="month"
                value={monthKey(from)}
                onChange={(e) => {
                  const v = parseMonthInput(e.target.value);
                  if (v) setFrom(v);
                }}
                className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
              />
            </label>
            <label className="text-xs text-slate-500">
              {t("pl.to")}
              <input
                type="month"
                value={monthKey(to)}
                onChange={(e) => {
                  const v = parseMonthInput(e.target.value);
                  if (v) setTo(v);
                }}
                className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            {t("pl.includeDetails")}
          </label>
          {rangeInvalid && <p className="text-xs text-rose-600">{t("pl.invalidRange")}</p>}
          {tooLong && <p className="text-xs text-rose-600">{t("pl.maxRange")}</p>}
          <button
            type="button"
            onClick={download}
            disabled={!canExport || generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
            {generating ? t("pl.generating") : t("pl.download")}
          </button>
          {error && <p className="break-all text-xs text-rose-600">{error}</p>}
        </div>

        {/* プレビュー（実際のPDFと同じ内容を縮小表示） */}
        {canExport && (
          <div className="space-y-4 p-4">
            <p className="text-xs font-medium text-slate-500">
              {t("pl.preview")}（{pageCount}p）
            </p>
            {Array.from({ length: pageCount }, (_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-sm shadow-md"
                style={{ width: size.width * scale, height: size.height * scale }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <div
                    ref={(el) => {
                      pageRefs.current[i] = el;
                    }}
                    className="flex flex-col bg-white px-12 py-10 text-slate-900"
                    style={{ width: size.width, height: size.height }}
                  >
                    <ReportHeader meta={meta} i18n={i18n} compact={i > 0} />
                    <div className="flex-1">
                      {i === 0 ? (
                        <PlTable months={months} transactions={inRange} allTransactions={all} ledgerInitial={ledger.initialBalance} showBalance={!!ledger.ownerId} i18n={i18n} />
                      ) : (
                        <DetailTable rows={detailPages[i - 1]} i18n={i18n} />
                      )}
                    </div>
                    <p className="text-right text-[10px] text-slate-400">
                      {i + 1} / {pageCount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 帳票の部品 ----------

type Meta = { title: string; ledger: string; period: string; createdAt: string; createdBy: string };

function ReportHeader({ meta, i18n, compact }: { meta: Meta; i18n: I18n; compact: boolean }) {
  const { t } = i18n;
  if (compact) {
    return (
      <div className="mb-4 flex items-baseline justify-between border-b border-slate-300 pb-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-900">{meta.title}</span>
        <span>
          {meta.ledger} ／ {meta.period}
        </span>
      </div>
    );
  }
  return (
    <div className="mb-6">
      <h1 className="text-center text-2xl font-bold tracking-wide">{meta.title}</h1>
      <div className="mt-5 flex items-end justify-between text-[12px]">
        <div className="space-y-0.5">
          <p>
            <span className="inline-block w-20 text-slate-500">{t("pl.ledger")}</span>
            <span className="font-semibold">{meta.ledger}</span>
          </p>
          <p>
            <span className="inline-block w-20 text-slate-500">{t("pl.period")}</span>
            {meta.period}
          </p>
        </div>
        <div className="space-y-0.5 text-right text-slate-600">
          <p>
            {t("pl.createdAt")}：{meta.createdAt}
          </p>
          <p>
            {t("pl.createdBy")}：{meta.createdBy}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlTable({
  months,
  transactions,
  allTransactions,
  ledgerInitial,
  showBalance,
  i18n,
}: {
  months: YearMonth[];
  transactions: Transaction[];
  allTransactions: Transaction[];
  ledgerInitial: number;
  showBalance: boolean;
  i18n: I18n;
}) {
  const { t, categoryLabel, formatAccounting } = i18n;
  const crossesYear = months.length > 0 && months[0].year !== months[months.length - 1].year;

  const amount = (type: MoneyType, category: string | null, ym: YearMonth | null) =>
    transactions
      .filter(
        (tx) =>
          tx.money.type === type &&
          (category === null || tx.money.category === category) &&
          (ym === null || tx.date.startsWith(monthKey(ym))),
      )
      .reduce((sum, tx) => sum + tx.money.amount, 0);

  const usedCategories = (type: MoneyType) => categories[type].filter((c) => amount(type, c, null) > 0);

  const cell = "border border-slate-300 px-2 py-1.5 text-right tabular-nums";
  const labelCell = "border border-slate-300 px-2 py-1.5 text-left";
  const fmt = (n: number) => (n === 0 ? "-" : formatAccounting(n));

  const section = (type: MoneyType) => {
    const used = usedCategories(type);
    return (
      <>
        <tr className="bg-slate-100 font-semibold">
          <td className={labelCell} colSpan={months.length + 2}>
            {t(type === "income" ? "pl.incomeSection" : "pl.expenseSection")}
          </td>
        </tr>
        {used.length === 0 && (
          <tr>
            <td className={`${labelCell} pl-5 text-slate-400`}>{t("pl.noRecords")}</td>
            {months.map((m) => (
              <td key={monthKey(m)} className={cell}>
                -
              </td>
            ))}
            <td className={cell}>-</td>
          </tr>
        )}
        {used.map((c) => (
          <tr key={c}>
            <td className={`${labelCell} pl-5`}>{categoryLabel(c)}</td>
            {months.map((m) => (
              <td key={monthKey(m)} className={cell}>
                {fmt(amount(type, c, m))}
              </td>
            ))}
            <td className={`${cell} font-semibold`}>{fmt(amount(type, c, null))}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className={labelCell}>{t(type === "income" ? "pl.incomeTotal" : "pl.expenseTotal")}</td>
          {months.map((m) => (
            <td key={monthKey(m)} className={cell}>
              {formatAccounting(amount(type, null, m))}
            </td>
          ))}
          <td className={cell}>{formatAccounting(amount(type, null, null))}</td>
        </tr>
      </>
    );
  };

  const net = (ym: YearMonth | null) => amount("income", null, ym) - amount("expense", null, ym);
  const endBalance = (ym: YearMonth) => {
    const endKey = toDateKey(new Date(ym.year, ym.month + 1, 0));
    const upTo = allTransactions.filter((tx) => tx.date <= endKey);
    return ledgerInitial + sumBy(upTo, "income") - sumBy(upTo, "expense");
  };

  return (
    <>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="border border-slate-800 px-2 py-1.5 text-left font-semibold">{t("pl.item")}</th>
            {months.map((m) => (
              <th key={monthKey(m)} className="border border-slate-800 px-2 py-1.5 text-right font-semibold">
                {monthLabel(m, i18n, crossesYear)}
              </th>
            ))}
            <th className="border border-slate-800 px-2 py-1.5 text-right font-semibold">{t("pl.total")}</th>
          </tr>
        </thead>
        <tbody>
          {section("income")}
          {section("expense")}
          <tr className="border-t-[3px] border-double border-slate-900 bg-indigo-50 font-bold">
            <td className={labelCell}>{t("pl.net")}</td>
            {months.map((m) => (
              <td key={monthKey(m)} className={cell}>
                {formatAccounting(net(m))}
              </td>
            ))}
            <td className={cell}>{formatAccounting(net(null))}</td>
          </tr>
          {showBalance && (
            <tr className="font-semibold">
              <td className={labelCell}>{t("pl.endBalance")}</td>
              {months.map((m) => (
                <td key={monthKey(m)} className={cell}>
                  {formatAccounting(endBalance(m))}
                </td>
              ))}
              <td className={`${cell} text-slate-400`}>-</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="mt-2 text-right text-[10px] text-slate-500">{t("pl.unit")}</p>
    </>
  );
}

function DetailTable({ rows, i18n }: { rows: Transaction[]; i18n: I18n }) {
  const { t, categoryLabel, memberName, formatAccounting } = i18n;
  const th = "border border-slate-800 px-2 py-1.5 font-semibold";
  const td = "border border-slate-300 px-2 py-1";
  return (
    <>
      <h2 className="mb-2 text-sm font-semibold">{t("pl.details")}</h2>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-slate-800 text-left text-white">
            <th className={th}>{t("pl.date")}</th>
            <th className={th}>{t("pl.description")}</th>
            <th className={th}>{t("pl.item")}</th>
            <th className={th}>{t("pl.assignee")}</th>
            <th className={`${th} text-right`}>{t("money.income")}</th>
            <th className={`${th} text-right`}>{t("money.expense")}</th>
            <th className={th}>{t("pl.attachments")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{tx.date.replaceAll("-", "/")}</td>
              <td className={td}>{tx.title}</td>
              <td className={td}>{categoryLabel(tx.money.category)}</td>
              <td className={td}>{memberName(getMember(tx.assigneeId))}</td>
              <td className={`${td} text-right tabular-nums`}>
                {tx.money.type === "income" ? formatAccounting(tx.money.amount) : ""}
              </td>
              <td className={`${td} text-right tabular-nums`}>
                {tx.money.type === "expense" ? formatAccounting(tx.money.amount) : ""}
              </td>
              <td className={td}>{tx.attachments.map((a) => t(`attach.${a.kind}`)).join("、")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ---------- 小さな関数 ----------

function monthLabel(ym: YearMonth, { lang }: I18n, withYear: boolean) {
  if (lang === "en") {
    return new Date(ym.year, ym.month, 1).toLocaleDateString("en-US", withYear ? { month: "short", year: "numeric" } : { month: "short" });
  }
  return withYear ? `${ym.year}年${ym.month + 1}月` : `${ym.month + 1}月`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
