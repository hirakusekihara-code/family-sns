import { ArrowDownRight, ArrowUpRight, MapPin, Paperclip } from "lucide-react";
import type { PlaceInfo } from "@/lib/placesStore";
import { useFamily } from "@/lib/family";
import { formatYen, type CalendarEvent } from "@/lib/calendarData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";

type Props = {
  event: CalendarEvent;
  placeOf: (id: string | undefined) => PlaceInfo | undefined;
  onOpen: () => void;
};

// 予定1件分の行（予定リスト用）
export default function EventRow({ event, placeOf, onOpen }: Props) {
  const { t, categoryLabel } = useI18n();
  const family = useFamily();
  if (!family.ready) return null;
  const assignee = family.member(event.assigneeId);
  const creator = family.member(event.createdById);
  const spot = placeOf(event.spotId);
  const place = spot ? `${spot.emoji} ${spot.name}` : event.place;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="w-11 shrink-0 text-xs leading-5 text-slate-500 tabular-nums">
        {event.allDay ? (
          t("cal.allDay")
        ) : (
          <>
            {event.start}
            <br />
            {event.end}
          </>
        )}
      </div>
      <span className={`w-1 shrink-0 rounded-full ${assignee.color}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[15px] font-semibold text-slate-900">{event.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Avatar member={assignee} size="sm" />
            {assignee.name}
            {creator.id !== assignee.id && (
              <span className="text-slate-400">({t("cal.addedBy", { name: creator.name })})</span>
            )}
          </span>
          {place && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {place}
            </span>
          )}
        </div>
        {(event.money || event.attachments.length > 0) && (
          <div className="flex items-center gap-3 text-xs text-slate-700">
            {event.money && (
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                {event.money.type === "expense" ? (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" aria-hidden />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                )}
                {t(event.money.type === "expense" ? "money.expense" : "money.income")} {formatYen(event.money.amount)}
                <span className="text-slate-400">· {categoryLabel(event.money.category)}</span>
              </span>
            )}
            {event.attachments.length > 0 && (
              <span className="flex items-center gap-0.5 text-slate-500">
                <Paperclip className="h-3.5 w-3.5" />
                {event.attachments.length}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
