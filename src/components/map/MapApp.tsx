"use client";

import { useState } from "react";
import { Bell, ChevronLeft, ChevronRight, ExternalLink, LocateFixed, MapPin, X } from "lucide-react";
import { getSpot } from "@/lib/mockData";
import { addDays, toDateKey, type CalendarEvent } from "@/lib/calendarData";
import { spotPositions } from "@/lib/mapData";
import { useFamily, type Member } from "@/lib/family";
import { useCalendar, useLocations, type SharedLocation } from "@/lib/calendarStore";
import { minutesSince } from "@/lib/timelineStore";
import { SETUP_NEEDED } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";
import MapCanvas, { type Pin, type Selection } from "./MapCanvas";
import MyLocationCard from "./MyLocationCard";

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.localeCompare(b.start);
}

function currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const mapsUrl = (loc: SharedLocation) => `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

// マップ画面：家族の今の予定の場所・共有された現在地と、場所つきの予定をポップアップで表示
export default function MapApp() {
  const family = useFamily();
  if (!family.ready) return null;
  return <MapInner familyId={family.family.id} />;
}

function MapInner({ familyId }: { familyId: string }) {
  const { t, spotName, formatDate, formatAgo } = useI18n();
  const family = useFamily();
  const calendar = useCalendar(familyId);
  const { locations, shareMyLocation } = useLocations(familyId);
  const [today] = useState(() => toDateKey(new Date()));
  const [now] = useState(currentTime);
  const [nowMs] = useState(() => Date.now());
  const [date, setDate] = useState(today);
  const [selection, setSelection] = useState<Selection>(null);

  if (!family.ready) return null;
  const { me, members } = family;

  const isToday = date === today;
  const events = calendar.events ?? [];
  const dayEvents = events.filter((e) => e.date === date).sort(sortEvents);
  const placed = dayEvents.filter((e) => e.spotId);
  const unmapped = dayEvents.filter((e) => !e.spotId && e.place);
  const eventCountBySpot: Record<string, number> = {};
  for (const e of placed) eventCountBySpot[e.spotId!] = (eventCountBySpot[e.spotId!] ?? 0) + 1;

  const isOngoing = (e: CalendarEvent) => isToday && (e.allDay || (e.start <= now && now < e.end));

  // 家族それぞれの「今の予定」（今日・場所つき・進行中）→ 地図上のアイコンの位置
  const currentPlan = (m: Member) => (isToday ? placed.find((e) => e.assigneeId === m.id && isOngoing(e)) : undefined);
  const pins: Pin[] = members.flatMap((m) => {
    const plan = currentPlan(m);
    return plan ? [{ member: m, spotId: plan.spotId! }] : [];
  });

  // 通知バナー：今日なら「進行中 or 次に始まる」場所つきの予定
  const upcoming = isToday ? placed.find((e) => !e.allDay && e.end > now) : undefined;

  // ポップアップは選んだアイコンのすぐ近くに吹き出しで出す
  const anchor =
    selection?.kind === "spot"
      ? spotPositions[selection.id]
      : spotPositions[pins.find((p) => p.member.id === selection?.id)?.spotId ?? ""];
  const popupAbove = (anchor?.y ?? 0) > 50;

  function focus(next: Selection) {
    setSelection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const planLabel = (e: CalendarEvent) => {
    const spot = getSpot(e.spotId);
    const place = spot ? `${spot.emoji} ${spotName(spot)}` : e.place;
    return t("map.planAt", { place, time: e.allDay ? t("cal.allDay") : t("map.until", { time: e.end }) });
  };

  return (
    <div className="pb-4">
      {/* 日付の切り替え */}
      <div className="flex items-center justify-between bg-white px-2 py-1.5">
        <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label={t("map.prevDay")} className="rounded-full p-1.5 hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{formatDate(date)}</span>
          {!isToday && (
            <button type="button" onClick={() => setDate(today)} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
              {t("cal.today")}
            </button>
          )}
        </div>
        <button type="button" onClick={() => setDate(addDays(date, 1))} aria-label={t("map.nextDay")} className="rounded-full p-1.5 hover:bg-slate-100">
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {calendar.error && (
        <p className="mx-3 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {calendar.error === SETUP_NEEDED ? t("setup.tablesMissing") : calendar.error}
        </p>
      )}

      {/* 通知バナー */}
      <div className="px-3 pb-2 pt-1">
        {upcoming ? (
          <button
            type="button"
            onClick={() => setSelection({ kind: "spot", id: upcoming.spotId! })}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-3 py-2.5 text-left text-white shadow-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Bell className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-white/70">
                {isOngoing(upcoming) ? t("map.now") : t("map.nextEvent")} · {upcoming.start}–{upcoming.end}
              </span>
              <span className="block truncate text-sm font-semibold">
                {family.member(upcoming.assigneeId).name} {upcoming.title}
              </span>
              <span className="block truncate text-xs text-white/80">
                {getSpot(upcoming.spotId)?.emoji} {getSpot(upcoming.spotId) ? spotName(getSpot(upcoming.spotId)!) : ""}
              </span>
            </span>
          </button>
        ) : (
          <p className="rounded-2xl bg-white px-3 py-2.5 text-xs text-slate-500 shadow-sm">
            {placed.length > 0 ? t("map.eventsWithPlace", { n: placed.length }) : t("map.noPlacedEvents")} · {t("map.tapHint")}
          </p>
        )}
      </div>

      {/* 地図 */}
      <MapCanvas eventCountBySpot={eventCountBySpot} pins={pins} youId={me.id} selection={selection} onSelect={setSelection}>
        {selection && anchor && (
          <div
            role="dialog"
            className="absolute z-30 max-h-[42%] w-[68%] overflow-y-auto rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200"
            style={{
              left: `${Math.min(Math.max(anchor.x, 35), 65)}%`,
              top: `${anchor.y}%`,
              transform: `translate(-50%, ${popupAbove ? "calc(-100% - 34px)" : "30px"})`,
            }}
          >
            <button
              type="button"
              onClick={() => setSelection(null)}
              aria-label={t("common.close")}
              className="absolute right-1 top-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            {selection.kind === "spot" ? (
              <SpotPopup
                spotId={selection.id}
                events={placed.filter((e) => e.spotId === selection.id)}
                here={pins.filter((p) => p.spotId === selection.id).map((p) => p.member)}
                isOngoing={isOngoing}
              />
            ) : (
              <MemberPopup
                member={family.member(selection.id)}
                events={dayEvents.filter((e) => e.assigneeId === selection.id)}
                location={locations[selection.id]}
                nowMs={nowMs}
                isOngoing={isOngoing}
              />
            )}
          </div>
        )}
      </MapCanvas>
      {pins.length > 0 && <p className="px-4 pt-2 text-[11px] text-slate-400">{t("map.pinNote")}</p>}

      <div className="space-y-4 p-4">
        {/* 家族の現在地 */}
        <section className="rounded-2xl bg-white shadow-sm">
          <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-slate-900">{t("map.family")}</h2>
          <ul>
            {members.map((m) => {
              const plan = currentPlan(m);
              const loc = locations[m.id];
              return (
                <li key={m.id} className="flex items-start gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => plan && focus({ kind: "member", id: m.id })}
                    className="shrink-0"
                    aria-label={m.name}
                  >
                    <Avatar member={m} />
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {m.name}
                      {m.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">({t("common.you")})</span>}
                    </p>
                    {plan && (
                      <p className="flex items-center gap-1 text-xs text-slate-600">
                        <MapPin className="h-3 w-3 shrink-0" /> {planLabel(plan)}
                      </p>
                    )}
                    {!m.shareLocation ? (
                      <p className="text-xs text-slate-400">{t("map.shareOff")}</p>
                    ) : loc ? (
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <LocateFixed className="h-3 w-3" />
                        {t("map.gpsShared", { ago: formatAgo(minutesSince(loc.updatedAt, nowMs)) })}
                        <a href={mapsUrl(loc)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-indigo-600">
                          {t("map.openMap")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">{t("map.noGps")}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 地図にない場所の予定 */}
        {unmapped.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t("map.unmapped")}</h2>
            <ul className="space-y-2">
              {unmapped.map((e) => (
                <PlanItem key={e.id} event={e} ongoing={isOngoing(e)} showPlace />
              ))}
            </ul>
          </section>
        )}

        <MyLocationCard
          shareEnabled={me.shareLocation}
          onLocated={(lat, lng, accuracy) => shareMyLocation(me.id, lat, lng, accuracy)}
        />
      </div>
    </div>
  );
}

// ---------- ポップアップの中身 ----------

function SpotPopup({
  spotId,
  events,
  here,
  isOngoing,
}: {
  spotId: string;
  events: CalendarEvent[];
  here: Member[];
  isOngoing: (e: CalendarEvent) => boolean;
}) {
  const { t, spotName } = useI18n();
  const spot = getSpot(spotId)!;
  return (
    <div>
      <p className="pr-7 text-base font-semibold text-slate-900">
        {spot.emoji} {spotName(spot)}
      </p>
      <h3 className="mb-1.5 mt-2 text-xs font-medium text-slate-500">{t("map.plans")}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">{t("map.noPlansHere")}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <PlanItem key={e.id} event={e} ongoing={isOngoing(e)} />
          ))}
        </ul>
      )}
      {here.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-2 text-xs font-medium text-slate-500">{t("map.familyHere")}</h3>
          <div className="flex flex-wrap gap-3">
            {here.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                <Avatar member={m} size="sm" />
                {m.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MemberPopup({
  member,
  events,
  location,
  nowMs,
  isOngoing,
}: {
  member: Member;
  events: CalendarEvent[];
  location?: SharedLocation;
  nowMs: number;
  isOngoing: (e: CalendarEvent) => boolean;
}) {
  const { t, formatAgo } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-3 pr-7">
        <Avatar member={member} />
        <div>
          <p className="text-base font-semibold text-slate-900">{member.name}</p>
          {member.shareLocation && location ? (
            <a href={mapsUrl(location)} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600">
              {t("map.gpsShared", { ago: formatAgo(minutesSince(location.updatedAt, nowMs)) })}
            </a>
          ) : (
            <p className="text-xs text-slate-400">{member.shareLocation ? t("map.noGps") : t("map.shareOff")}</p>
          )}
        </div>
      </div>
      <h3 className="mb-1.5 mt-2 text-xs font-medium text-slate-500">{t("map.plans")}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">{t("map.noPlansHere")}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <PlanItem key={e.id} event={e} ongoing={isOngoing(e)} showPlace />
          ))}
        </ul>
      )}
    </div>
  );
}

// 予定1件（例：パパ 09:00–18:00 勤務）
function PlanItem({ event, ongoing, showPlace = false }: { event: CalendarEvent; ongoing: boolean; showPlace?: boolean }) {
  const { t, spotName } = useI18n();
  const family = useFamily();
  if (!family.ready) return null;
  const member = family.member(event.assigneeId);
  const spot = getSpot(event.spotId);
  const place = spot ? `${spot.emoji} ${spotName(spot)}` : event.place;
  return (
    <li className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5">
      <span className={`mt-0.5 w-1 self-stretch rounded-full ${member.color}`} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
          {event.allDay ? t("cal.allDay") : `${event.start}–${event.end}`}
          {ongoing && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">{t("map.now")}</span>}
        </p>
        <p className="text-sm text-slate-900">
          <span className="font-semibold">{member.name}</span> {event.title}
        </p>
        {showPlace && place && <p className="text-xs text-slate-500">{place}</p>}
      </div>
    </li>
  );
}
