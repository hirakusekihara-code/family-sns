"use client";

// よく行く場所（自宅・会社・学校など）：家族で地図に登録して共有します
import { useCallback, useEffect, useState } from "react";
import { describeDbError, refreshPeriodically, supabase } from "@/lib/supabase/client";
import { getSpot } from "@/lib/mockData";
import type { I18n } from "@/lib/i18n/useI18n";

export type Place = { id: string; name: string; emoji: string; lat: number; lng: number };

// 場所を登録するときの候補（名前とアイコンのひな形）
export const placePresets: { emoji: string; ja: string; en: string }[] = [
  { emoji: "🏠", ja: "自宅", en: "Home" },
  { emoji: "🏢", ja: "会社", en: "Office" },
  { emoji: "🏫", ja: "学校", en: "School" },
  { emoji: "🎒", ja: "小学校", en: "Elementary school" },
  { emoji: "🧸", ja: "保育園", en: "Daycare" },
  { emoji: "📚", ja: "塾", en: "Cram school" },
  { emoji: "🛒", ja: "スーパー", en: "Supermarket" },
  { emoji: "🏥", ja: "病院", en: "Hospital" },
  { emoji: "🦷", ja: "歯医者", en: "Dentist" },
  { emoji: "⚽", ja: "グラウンド", en: "Sports field" },
  { emoji: "🚉", ja: "駅", en: "Station" },
  { emoji: "🌳", ja: "公園", en: "Park" },
  { emoji: "👵", ja: "おばあちゃんの家", en: "Grandma's house" },
];

export const placeEmojis = ["📍", ...new Set(placePresets.map((p) => p.emoji)), "⛪", "🏋️", "🍽️", "✈️"];

export function usePlaces(familyId: string) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    supabase()
      .from("places")
      .select("id, name, emoji, lat, lng")
      .eq("family_id", familyId)
      .order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        setError(error ? describeDbError(error) : null);
        if (!error) setPlaces((data ?? []) as Place[]);
      });
    return () => {
      active = false;
    };
  }, [familyId, version]);

  useEffect(() => {
    const channel = supabase()
      .channel(`places-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "places", filter: `family_id=eq.${familyId}` }, reload)
      .subscribe();
    const stop = refreshPeriodically(reload, 120_000);
    return () => {
      supabase().removeChannel(channel);
      stop();
    };
  }, [familyId, reload]);

  const run = async (op: PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    const { error } = await op;
    if (error) return describeDbError(error);
    reload();
    return null;
  };

  return {
    places,
    error,
    addPlace: (p: Omit<Place, "id">) => run(supabase().from("places").insert(p)),
    updatePlace: (id: string, p: Omit<Place, "id">) => run(supabase().from("places").update(p).eq("id", id)),
    deletePlace: (id: string) => run(supabase().from("places").delete().eq("id", id)),
  };
}

// 予定の「場所」（spot_id）から、表示用の名前・アイコン・座標を引く
// 家族が登録した場所を優先し、以前の固定の場所（自宅・会社…）にも対応
export type PlaceInfo = { id: string; name: string; emoji: string; lat?: number; lng?: number };

export function makePlaceLookup(places: Place[] | null, { spotName }: I18n) {
  return (id: string | undefined): PlaceInfo | undefined => {
    if (!id) return undefined;
    const p = places?.find((x) => x.id === id);
    if (p) return p;
    const legacy = getSpot(id);
    return legacy ? { id, name: spotName(legacy), emoji: legacy.emoji } : undefined;
  };
}

// Googleマップで道案内を開くURL
export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
