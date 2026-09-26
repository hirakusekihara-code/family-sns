"use client";

import { useState } from "react";
import { Bell, ChevronLeft, ChevronRight, ExternalLink, LocateFixed, MapPin, Navigation, Pencil, Plus, Trash2, X } from "lucide-react";
import { addDays, toDateKey, type CalendarEvent } from "@/lib/calendarData";
import { useFamily, type Member } from "@/lib/family";
import { useCalendar, useLocations, type SharedLocation } from "@/lib/calendarStore";
import { directionsUrl, makePlaceLookup, placeEmojis, placePresets, usePlaces, type Place, type PlaceInfo } from "@/lib/placesStore";
import { minutesSince } from "@/lib/timelineStore";
import { SETUP_NEEDED } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";
import FamilyMap, { type FocusRequest, type LatLng, type MapMember, type MapPlace } from "./FamilyMap";
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
const TOKYO: LatLng = { lat: 35.6812, lng: 139.7671 }; // 何も登録がないときの地図の中心

// 場所の登録・編集フォームの状態
type PlaceForm = { id: string | null; name: string; emoji: string; pos: LatLng | null };

// マップ画面：本物の地図に、家族の現在地・登録した場所・場所つきの予定を表示
export default function MapApp() {
  const family = useFamily();
  if (!family.ready) return null;
  return <MapInner familyId={family.family.id} />;
}

function MapInner({ familyId }: { familyId: string }) {
  const i18n = useI18n();
  const { t, lang, formatDate, formatAgo } = i18n;
  const family = useFamily();
  const calendar = useCalendar(familyId);
  const { locations, shareMyLocation } = useLocations(familyId);
  const placesStore = usePlaces(familyId);
  const [today] = useState(() => toDateKey(new Date()));
  const [now] = useState(currentTime);
  const [nowMs] = useState(() => Date.now());
  const [date, setDate] = useState(today);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [form, setForm] = useState<PlaceForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!family.ready) return null;
  const { me, members } = family;
  const places = placesStore.places ?? [];
  const placeOf = makePlaceLookup(placesStore.places, i18n);

  const isToday = date === today;
  const events = calendar.events ?? [];
  const dayEvents = events.filter((e) => e.date === date).sort(sortEvents);
  const isOngoing = (e: CalendarEvent) => isToday && (e.allDay || (e.start <= now && now < e.end));
  const eventsAt = (placeId: string) => dayEvents.filter((e) => e.spotId === placeId);
  // 地図にない場所の予定（場所の名前だけ・以前の固定の場所）
  const unmapped = dayEvents.filter((e) => (e.spotId || e.place) && placeOf(e.spotId)?.lat === undefined);

  // 家族それぞれの「今の予定」（今日・進行中・地図に登録した場所）
  const currentPlan = (m: Member) =>
    isToday ? dayEvents.find((e) => e.assigneeId === m.id && isOngoing(e) && placeOf(e.spotId)?.lat !== undefined) : undefined;

  // 家族のアイコンの位置：共有されたGPSを優先、なければ今の予定の場所
  const memberPins: MapMember[] = members.flatMap((m): MapMember[] => {
    const loc = m.shareLocation ? locations[m.id] : undefined;
    if (loc) return [{ member: m, lat: loc.lat, lng: loc.lng, source: "gps" }];
    const plan = currentPlan(m);
    const place = plan ? placeOf(plan.spotId) : undefined;
    return place?.lat !== undefined ? [{ member: m, lat: place.lat, lng: place.lng!, source: "plan" }] : [];
  });

  const mapPlaces: MapPlace[] = places.map((p) => ({ ...p, count: eventsAt(p.id).length }));
  const placedCount = mapPlaces.reduce((n, p) => n + p.count, 0);

  // 通知バナー：今日なら「進行中 or 次に始まる」場所つきの予定
  const upcoming = isToday ? dayEvents.find((e) => !e.allDay && e.end > now && placeOf(e.spotId)) : undefined;

  const focusOn = (pos: LatLng, markerId?: string) => {
    setFocus((f) => ({ ...pos, markerId, seq: (f?.seq ?? 0) + 1 })); // seq を増やすたびに地図が移動
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function locateMe(then: (pos: LatLng) => void) {
    navigator.geolocation?.getCurrentPosition(
      (p) => then({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ---------- 場所の登録・編集 ----------
  function startAdd() {
    setForm({ id: null, name: "", emoji: "📍", pos: null });
    setFormError(null);
    setPickMode(true);
  }
  function startEdit(p: Place) {
    setForm({ id: p.id, name: p.name, emoji: p.emoji, pos: { lat: p.lat, lng: p.lng } });
    setFormError(null);
    setPickMode(true);
  }
  function closeForm() {
    setForm(null);
    setPickMode(false);
  }
  async function saveForm() {
    if (!form?.pos || !form.name.trim()) return;
    const value = { name: form.name.trim(), emoji: form.emoji, lat: form.pos.lat, lng: form.pos.lng };
    const error = form.id ? await placesStore.updatePlace(form.id, value) : await placesStore.addPlace(value);
    if (error) return setFormError(error === SETUP_NEEDED ? t("setup.tablesMissing") : error);
    closeForm();
  }
  async function deletePlace(p: Place) {
    if (!window.confirm(t("map.deletePlaceConfirm"))) return;
    const error = await placesStore.deletePlace(p.id);
    if (error) setFormError(error);
    closeForm();
  }

  const planLabel = (e: CalendarEvent) => {
    const place = placeOf(e.spotId);
    const where = place ? `${place.emoji} ${place.name}` : e.place;
    return t("map.planAt", { place: where, time: e.allDay ? t("cal.allDay") : t("map.until", { time: e.end }) });
  };

  const dbError = calendar.error ?? placesStore.error;

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

      {dbError && (
        <p className="mx-3 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {dbError === SETUP_NEEDED ? t("setup.tablesMissing") : dbError}
        </p>
      )}

      {/* 通知バナー */}
      <div className="px-3 pb-2 pt-1">
        {calendar.events === null ? (
          <p className="rounded-2xl bg-white px-3 py-2.5 text-xs text-slate-400 shadow-sm">{t("common.loading")}</p>
        ) : upcoming ? (
          <button
            type="button"
            onClick={() => {
              const p = placeOf(upcoming.spotId);
              if (p?.lat !== undefined) focusOn({ lat: p.lat, lng: p.lng! }, `place-${p.id}`);
            }}
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
                {placeOf(upcoming.spotId)?.emoji} {placeOf(upcoming.spotId)?.name}
              </span>
            </span>
          </button>
        ) : (
          <p className="rounded-2xl bg-white px-3 py-2.5 text-xs text-slate-500 shadow-sm">
            {placedCount > 0 ? t("map.eventsWithPlace", { n: placedCount }) : t("map.noPlacedEvents")} · {t("map.tapHint")}
          </p>
        )}
      </div>

      {/* 地図（z-0 で、地図の部品が上のヘッダーや下のナビに重ならないようにする） */}
      <div className="relative z-0 h-[58vh] w-full overflow-hidden">
        <FamilyMap
          places={mapPlaces}
          members={memberPins}
          youId={me.id}
          youLabel={t("common.you")}
          pickMode={pickMode}
          draft={form?.pos ?? null}
          onPick={(pos) => setForm((f) => (f ? { ...f, pos } : f))}
          focus={focus}
          fallbackCenter={TOKYO}
          renderPlacePopup={(id) => {
            const p = places.find((x) => x.id === id);
            return p ? (
              <PlacePopup
                place={p}
                events={eventsAt(p.id)}
                here={memberPins.filter((m) => m.source === "plan" && currentPlan(m.member)?.spotId === p.id).map((m) => m.member)}
                isOngoing={isOngoing}
                onEdit={() => startEdit(p)}
              />
            ) : null;
          }}
          renderMemberPopup={(id) => (
            <MemberPopup
              member={family.member(id)}
              events={dayEvents.filter((e) => e.assigneeId === id)}
              location={locations[id]}
              nowMs={nowMs}
              isOngoing={isOngoing}
              placeOf={placeOf}
            />
          )}
        />

        {/* 地図の上のボタン */}
        {!pickMode && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-[1000] flex justify-between">
            <button
              type="button"
              onClick={startAdd}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold text-indigo-700 shadow-md"
            >
              <Plus className="h-4 w-4" />
              {t("map.addPlace")}
            </button>
            <button
              type="button"
              onClick={() => locateMe((pos) => focusOn(pos))}
              aria-label={t("map.locateMe")}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-700 shadow-md"
            >
              <Navigation className="h-5 w-5" />
            </button>
          </div>
        )}
        {pickMode && !form?.pos && (
          <div className="absolute inset-x-2 top-2 z-[1000] rounded-2xl bg-slate-900/90 p-3 text-white shadow-lg">
            <p className="text-sm font-semibold">{t("map.addPlaceHint")}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => locateMe((pos) => {
                  setForm((f) => (f ? { ...f, pos } : f));
                  setFocus((f) => ({ ...pos, seq: (f?.seq ?? 0) + 1 }));
                })}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {t("map.useHere")}
              </button>
              <button type="button" onClick={closeForm} className="rounded-full px-3 py-1.5 text-xs text-white/80">
                {t("map.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        {/* 家族の現在地 */}
        <section className="rounded-2xl bg-white shadow-sm">
          <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-slate-900">{t("map.family")}</h2>
          <ul>
            {members.map((m) => {
              const plan = currentPlan(m);
              const loc = locations[m.id];
              const pin = memberPins.find((p) => p.member.id === m.id);
              return (
                <li key={m.id} className="flex items-start gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => pin && focusOn({ lat: pin.lat, lng: pin.lng }, `member-${m.id}`)}
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

        {/* 登録した場所 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{t("map.places")}</h2>
          {places.length === 0 ? (
            <p className="text-sm text-slate-500">{t("map.noPlacesHint")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => focusOn({ lat: p.lat, lng: p.lng }, `place-${p.id}`)}
                  className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700"
                >
                  {p.emoji} {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 地図にない場所の予定 */}
        {unmapped.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t("map.unmapped")}</h2>
            <ul className="space-y-2">
              {unmapped.map((e) => (
                <PlanItem key={e.id} event={e} ongoing={isOngoing(e)} placeOf={placeOf} showPlace />
              ))}
            </ul>
          </section>
        )}

        <MyLocationCard
          shareEnabled={me.shareLocation}
          onLocated={(lat, lng, accuracy) => shareMyLocation(me.id, lat, lng, accuracy)}
        />
      </div>

      {/* 場所の登録・編集シート */}
      {form && form.pos && (
        <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[60vh] max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{t(form.id ? "map.editPlace" : "map.newPlace")}</h2>
            <button type="button" onClick={closeForm} aria-label={t("common.close")} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t("map.moveHint")}</p>

          <p className="mb-1 text-xs font-medium text-slate-500">{t("map.placeSuggestions")}</p>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {placePresets.map((p) => (
              <button
                key={p.ja}
                type="button"
                onClick={() => setForm({ ...form, name: lang === "en" ? p.en : p.ja, emoji: p.emoji })}
                className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
              >
                {p.emoji} {lang === "en" ? p.en : p.ja}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="place-name">
            {t("map.placeName")}
          </label>
          <input
            id="place-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={40}
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-indigo-500"
          />

          <p className="mb-1 text-xs font-medium text-slate-500">{t("map.placeIcon")}</p>
          <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("map.placeIcon")}>
            {placeEmojis.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={form.emoji === e}
                onClick={() => setForm({ ...form, emoji: e })}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                  form.emoji === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "bg-slate-100"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {formError && (
            <p className="mb-2 text-sm text-rose-600" role="alert">
              {formError}
            </p>
          )}
          <button
            type="button"
            onClick={saveForm}
            disabled={!form.name.trim()}
            className="w-full rounded-xl bg-indigo-600 py-3 text-[15px] font-semibold text-white disabled:bg-slate-300"
          >
            {t(form.id ? "map.saveChanges" : "map.savePlace")}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => deletePlace(places.find((p) => p.id === form.id)!)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-sm text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
              {t("map.deletePlace")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- ポップアップの中身 ----------

function PlacePopup({
  place,
  events,
  here,
  isOngoing,
  onEdit,
}: {
  place: Place;
  events: CalendarEvent[];
  here: Member[];
  isOngoing: (e: CalendarEvent) => boolean;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="font-sans">
      <p className="text-base font-semibold text-slate-900">
        {place.emoji} {place.name}
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
                <Avatar member={m} size="xs" />
                {m.name}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <a
          href={directionsUrl(place.lat, place.lng)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
        >
          <Navigation className="h-3.5 w-3.5" />
          {t("map.directions")}
        </a>
        <button type="button" onClick={onEdit} aria-label={t("map.editPlace")} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MemberPopup({
  member,
  events,
  location,
  nowMs,
  isOngoing,
  placeOf,
}: {
  member: Member;
  events: CalendarEvent[];
  location?: SharedLocation;
  nowMs: number;
  isOngoing: (e: CalendarEvent) => boolean;
  placeOf: (id: string | undefined) => PlaceInfo | undefined;
}) {
  const { t, formatAgo } = useI18n();
  return (
    <div className="font-sans">
      <div className="flex items-center gap-3">
        <Avatar member={member} />
        <div>
          <p className="text-base font-semibold text-slate-900">{member.name}</p>
          {member.shareLocation && location ? (
            <a href={mapsUrl(location)} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600">
              {t("map.gpsShared", { ago: formatAgo(minutesSince(location.updatedAt, nowMs)) })}
            </a>
          ) : (
            <p className="text-xs text-slate-400">{member.shareLocation ? t("map.fromPlan") : t("map.shareOff")}</p>
          )}
        </div>
      </div>
      <h3 className="mb-1.5 mt-2 text-xs font-medium text-slate-500">{t("map.plans")}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">{t("map.noPlansHere")}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <PlanItem key={e.id} event={e} ongoing={isOngoing(e)} placeOf={placeOf} showPlace />
          ))}
        </ul>
      )}
    </div>
  );
}

// 予定1件（例：パパ 09:00–18:00 勤務）
function PlanItem({
  event,
  ongoing,
  placeOf,
  showPlace = false,
}: {
  event: CalendarEvent;
  ongoing: boolean;
  placeOf?: (id: string | undefined) => PlaceInfo | undefined;
  showPlace?: boolean;
}) {
  const { t } = useI18n();
  const family = useFamily();
  if (!family.ready) return null;
  const member = family.member(event.assigneeId);
  const place = placeOf?.(event.spotId);
  const where = place ? `${place.emoji} ${place.name}` : event.place;
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
        {showPlace && where && <p className="text-xs text-slate-500">{where}</p>}
      </div>
    </li>
  );
}
