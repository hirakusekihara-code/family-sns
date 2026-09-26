import { monthGridDays, parseDateKey, type CalendarEvent, type YearMonth } from "@/lib/calendarData";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  cursor: YearMonth;
  today: string;
  selected: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  colorOf: (memberId: string) => string; // 担当者のテーマカラー
  onSelect: (date: string) => void;
};

const MAX_CHIPS = 2;

// Googleカレンダー風の月表示
export default function MonthGrid({ cursor, today, selected, eventsByDate, colorOf, onSelect }: Props) {
  const { t, weekdays, formatDate } = useI18n();
  const days = monthGridDays(cursor);

  return (
    <div className="bg-white">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {weekdays.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 text-center text-[11px] font-medium ${
              i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : "text-slate-500"
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const d = parseDateKey(date);
          const inMonth = d.getMonth() === cursor.month;
          const isToday = date === today;
          const isSelected = date === selected;
          const events = eventsByDate[date] ?? [];
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={t("cal.dayAria", { date: formatDate(date), n: events.length })}
              aria-pressed={isSelected}
              className={`flex h-[4.6rem] min-w-0 flex-col items-stretch gap-0.5 border-b border-r border-slate-100 px-0.5 pt-1 text-left transition ${
                isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-indigo-600 font-bold text-white"
                    : inMonth
                      ? d.getDay() === 0
                        ? "text-rose-500"
                        : d.getDay() === 6
                          ? "text-sky-600"
                          : "text-slate-800"
                      : "text-slate-300"
                }`}
              >
                {d.getDate()}
              </span>
              {events.slice(0, MAX_CHIPS).map((ev) => (
                <span
                  key={ev.id}
                  className={`truncate rounded-[4px] px-1 text-[10px] leading-4 text-white ${colorOf(ev.assigneeId)} ${
                    inMonth ? "" : "opacity-40"
                  }`}
                >
                  {ev.title}
                </span>
              ))}
              {events.length > MAX_CHIPS && (
                <span className="px-1 text-[10px] leading-3 text-slate-500">+{events.length - MAX_CHIPS}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
