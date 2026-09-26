"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  categories,
  ledgersFor,
  parseDateKey,
  shiftMonth,
  toDateKey,
  visibleLedgers,
  type CalendarEvent,
  type YearMonth,
} from "@/lib/calendarData";
import { useFamily } from "@/lib/family";
import { useCalendar } from "@/lib/calendarStore";
import { makePlaceLookup, usePlaces } from "@/lib/placesStore";
import { SETUP_NEEDED } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/useI18n";
import LanguageToggle from "@/components/common/LanguageToggle";
import MonthGrid from "./MonthGrid";
import EventRow from "./EventRow";
import EventEditor from "./EventEditor";
import MoneyView from "./MoneyView";
import PlExport from "./PlExport";

type Tab = "calendar" | "money";
type Filter = "all" | "mine";
type EditorState = { event: CalendarEvent; isNew: boolean } | null;

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.localeCompare(b.start);
}

// カレンダー画面全体。予定は Supabase に保存され、家族全員で共有されます
export default function CalendarApp() {
  const family = useFamily();
  if (!family.ready) return null;
  return <CalendarInner familyId={family.family.id} />;
}

function CalendarInner({ familyId }: { familyId: string }) {
  const i18n = useI18n();
  const { t, monthTitle, formatDate } = i18n;
  const family = useFamily();
  const calendar = useCalendar(familyId);
  const { places } = usePlaces(familyId); // マップで登録した場所
  const [today] = useState(() => toDateKey(new Date()));
  const [tab, setTab] = useState<Tab>("calendar");
  const [filter, setFilter] = useState<Filter>("all");
  const [cursor, setCursor] = useState<YearMonth>(() => {
    const d = parseDateKey(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [editor, setEditor] = useState<EditorState>(null);
  const [ledgerId, setLedgerId] = useState("household");
  const [showPl, setShowPl] = useState(false);

  if (!family.ready) return null;
  const { me, members, member } = family;
  const events = calendar.events ?? [];
  const placeOf = makePlaceLookup(places, i18n);
  const allLedgers = ledgersFor(members);
  // 見られる帳簿（保護者：すべて、子ども：自分のお小遣い帳、親族：なし）
  const ledgerOptions = visibleLedgers(allLedgers, me);
  const activeLedgerId = ledgerOptions.some((l) => l.id === ledgerId) ? ledgerId : (ledgerOptions[0]?.id ?? null);

  const shown = filter === "mine" ? events.filter((e) => e.assigneeId === me.id) : events;
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of [...shown].sort(sortEvents)) (eventsByDate[e.date] ??= []).push(e);
  const dayEvents = eventsByDate[selected] ?? [];

  function goToday() {
    const d = parseDateKey(today);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  }

  function moveMonth(diff: number) {
    const next = shiftMonth(cursor, diff);
    setCursor(next);
    setSelected(toDateKey(new Date(next.year, next.month, 1)));
  }

  function openNew() {
    const base: CalendarEvent = {
      id: "", // 保存するときにデータベースが決めます
      title: "",
      assigneeId: me.id,
      createdById: me.id,
      date: selected,
      allDay: false,
      start: "09:00",
      end: "10:00",
      place: "",
      memo: "",
      attachments: [],
    };
    if (tab === "money" && activeLedgerId) {
      // 家計簿タブからは「出金の記録」として開く（担当は帳簿の持ち主）
      const owner = ledgerOptions.find((l) => l.id === activeLedgerId)?.ownerId;
      base.allDay = true;
      base.assigneeId = owner ?? me.id;
      base.money = { type: "expense", amount: 0, category: categories.expense[0], ledgerId: activeLedgerId };
    }
    setEditor({ event: base, isNew: true });
  }

  // 保存（失敗したときはエラー文を返し、編集画面に表示）
  async function saveEvent(event: CalendarEvent) {
    const error = await calendar.saveEvent(event, editor?.isNew ? null : editor!.event);
    if (error) return error;
    setSelected(event.date);
    const d = parseDateKey(event.date);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setEditor(null);
    return null;
  }

  async function deleteEvent(event: CalendarEvent) {
    const error = await calendar.deleteEvent(event);
    if (error) return error;
    setEditor(null);
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pt-2">
          <button type="button" onClick={() => moveMonth(-1)} aria-label={t("cal.prevMonth")} className="rounded-full p-1.5 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="min-w-0 truncate text-xl font-semibold text-slate-900">{monthTitle(cursor)}</h1>
          <button type="button" onClick={() => moveMonth(1)} aria-label={t("cal.nextMonth")} className="rounded-full p-1.5 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-auto rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("cal.today")}
          </button>
          <span className="ml-1">
            <LanguageToggle />
          </span>
        </div>
        <div className="grid grid-cols-2">
          {(["calendar", "money"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative py-2 text-sm font-semibold transition ${tab === id ? "text-indigo-700" : "text-slate-400"}`}
            >
              {t(id === "calendar" ? "cal.tab.calendar" : "cal.tab.money")}
              {tab === id && <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-indigo-600" />}
            </button>
          ))}
        </div>
      </header>

      {calendar.error && (
        <p className="m-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {calendar.error === SETUP_NEEDED ? t("setup.tablesMissing") : calendar.error}
        </p>
      )}

      {calendar.events === null && !calendar.error ? (
        <p className="py-10 text-center text-sm text-slate-400">{t("common.loading")}</p>
      ) : tab === "calendar" ? (
        <>
          {/* フィルター：全員 / 自分のみ */}
          <div className="flex items-center gap-2 overflow-x-auto bg-white px-4 py-2">
            {(["all", "mine"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === f ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {t(f === "all" ? "cal.filter.all" : "cal.filter.mine")}
              </button>
            ))}
            <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />
            {members.map((m) => (
              <span key={m.id} className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${m.color}`} />
                {m.name}
              </span>
            ))}
          </div>

          <MonthGrid
            cursor={cursor}
            today={today}
            selected={selected}
            eventsByDate={eventsByDate}
            colorOf={(id) => member(id).color}
            onSelect={setSelected}
          />

          {/* 選んだ日の予定 */}
          <section className="space-y-2 p-4">
            <h2 className="text-sm font-semibold text-slate-700">{formatDate(selected)}</h2>
            {dayEvents.length === 0 ? (
              <button
                type="button"
                onClick={openNew}
                className="w-full rounded-2xl border border-dashed border-slate-300 py-6 text-sm text-slate-400"
              >
                {t("cal.noEvents")} · <span className="text-indigo-600">{t("cal.addEvent")}</span>
              </button>
            ) : (
              dayEvents.map((e) => <EventRow key={e.id} event={e} placeOf={placeOf} onOpen={() => setEditor({ event: e, isNew: false })} />)
            )}
          </section>
        </>
      ) : (
        <MoneyView
          events={events}
          ledgers={ledgerOptions}
          isChild={me.role === "child"}
          cursor={cursor}
          ledgerId={activeLedgerId}
          onLedgerChange={setLedgerId}
          onOpen={(e) => setEditor({ event: e, isNew: false })}
          onExportPl={() => setShowPl(true)}
        />
      )}

      {/* 追加ボタン（Googleカレンダー風） */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md justify-end px-4">
        <button
          type="button"
          onClick={openNew}
          aria-label={t("cal.add")}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 transition active:scale-95"
        >
          <Plus className="h-8 w-8 text-indigo-600" strokeWidth={2.5} />
        </button>
      </div>

      {editor && (
        <EventEditor
          key={editor.event.id}
          event={editor.event}
          isNew={editor.isNew}
          ledgers={ledgerOptions}
          allLedgers={allLedgers}
          places={places ?? []}
          placeOf={placeOf}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setEditor(null)}
        />
      )}

      {showPl && activeLedgerId && (
        <PlExport
          events={events}
          ledgers={ledgerOptions}
          preparedBy={me.name}
          initialLedgerId={activeLedgerId}
          initialMonth={cursor}
          onClose={() => setShowPl(false)}
        />
      )}
    </>
  );
}
