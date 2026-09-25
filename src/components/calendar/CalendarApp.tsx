"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createId, currentUserId, familyMembers, getMember } from "@/lib/mockData";
import {
  categories,
  parseDateKey,
  shiftMonth,
  toDateKey,
  visibleLedgers,
  type CalendarEvent,
  type YearMonth,
} from "@/lib/calendarData";
import { useI18n } from "@/lib/i18n/useI18n";
import { updateEvents, useEvents } from "@/lib/eventStore";
import LanguageToggle from "@/components/common/LanguageToggle";
import Avatar from "@/components/timeline/Avatar";
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

// カレンダー画面全体。予定はマップ画面と共有します（再読み込みで元に戻ります）
export default function CalendarApp() {
  const { t, memberName, monthTitle, formatDate } = useI18n();
  const [today] = useState(() => toDateKey(new Date()));
  const events = useEvents(); // マップ画面と共有
  const [viewerId, setViewerId] = useState(currentUserId);
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

  const viewer = getMember(viewerId);
  // 表示ユーザーが見られない帳簿が選ばれていたら、見られる帳簿に切り替える
  const ledgerOptions = visibleLedgers(viewerId);
  const activeLedgerId = ledgerOptions.some((l) => l.id === ledgerId) ? ledgerId : ledgerOptions[0].id;

  const shown = filter === "mine" ? events.filter((e) => e.assigneeId === viewerId) : events;
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
      id: createId("ev"),
      title: "",
      assigneeId: viewerId,
      createdById: viewerId,
      date: selected,
      allDay: false,
      start: "09:00",
      end: "10:00",
      place: "",
      memo: "",
      attachments: [],
    };
    if (tab === "money") {
      // 家計簿タブからは「出金の記録」として開く（担当は帳簿の持ち主）
      const owner = ledgerOptions.find((l) => l.id === activeLedgerId)?.ownerId;
      base.allDay = true;
      base.assigneeId = owner ?? viewerId;
      base.money = { type: "expense", amount: 0, category: categories.expense[0], ledgerId: activeLedgerId };
    }
    setEditor({ event: base, isNew: true });
  }

  function saveEvent(event: CalendarEvent) {
    updateEvents((prev) =>
      prev.some((e) => e.id === event.id) ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event],
    );
    setSelected(event.date);
    const d = parseDateKey(event.date);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setEditor(null);
  }

  function deleteEvent(id: string) {
    updateEvents((prev) => prev.filter((e) => e.id !== id));
    setEditor(null);
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
          {/* 表示ユーザーの切り替え（プロトタイプ用） */}
          <label className="relative ml-1 flex items-center gap-0.5 rounded-full p-0.5 hover:bg-slate-100" title={t("cal.viewAs")}>
            <Avatar member={viewer} size="sm" />
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={viewerId}
              onChange={(e) => setViewerId(e.target.value)}
              aria-label={t("cal.viewAs")}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.emoji} {memberName(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-1">
          <p className="text-[11px] text-slate-400">
            {t("cal.viewAs")}：{memberName(viewer)}
          </p>
          <LanguageToggle />
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

      {tab === "calendar" ? (
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
            {familyMembers.map((m) => (
              <span key={m.id} className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${m.color}`} />
                {memberName(m)}
              </span>
            ))}
          </div>

          <MonthGrid cursor={cursor} today={today} selected={selected} eventsByDate={eventsByDate} onSelect={setSelected} />

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
              dayEvents.map((e) => <EventRow key={e.id} event={e} onOpen={() => setEditor({ event: e, isNew: false })} />)
            )}
          </section>
        </>
      ) : (
        <MoneyView
          events={events}
          viewerId={viewerId}
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
          viewerId={viewerId}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setEditor(null)}
        />
      )}

      {showPl && (
        <PlExport
          events={events}
          viewerId={viewerId}
          initialLedgerId={activeLedgerId}
          initialMonth={cursor}
          onClose={() => setShowPl(false)}
        />
      )}
    </>
  );
}
