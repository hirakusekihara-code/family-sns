"use client";

// カレンダー（予定・家計簿・添付ファイル）とマップ（現在地）のデータ
// Supabase に保存され、家族の誰かが変更すると自動で最新になります。
import { useCallback, useEffect, useState } from "react";
import { createId } from "@/lib/mockData";
import { describeDbError, refreshPeriodically, supabase } from "@/lib/supabase/client";
import type { Attachment, AttachmentKind, CalendarEvent, MoneyType } from "@/lib/calendarData";

const BUCKET = "attachments";

type MoneyRow = { type: MoneyType; amount: number; category: string; ledger: string };
type EventRow = {
  id: string;
  created_by: string;
  assignee_id: string;
  title: string;
  date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  spot_id: string | null;
  place: string;
  memo: string;
  event_money: MoneyRow | MoneyRow[] | null;
  event_attachments: { id: string; kind: AttachmentKind; name: string; mime_type: string; storage_path: string }[];
};

function toEvent(r: EventRow): CalendarEvent {
  const money = Array.isArray(r.event_money) ? r.event_money[0] : r.event_money;
  return {
    id: r.id,
    title: r.title,
    assigneeId: r.assignee_id,
    createdById: r.created_by,
    date: r.date,
    allDay: r.all_day,
    start: r.start_time,
    end: r.end_time,
    spotId: r.spot_id ?? undefined,
    place: r.place,
    memo: r.memo,
    money: money ? { type: money.type, amount: money.amount, category: money.category, ledgerId: money.ledger } : undefined,
    attachments: r.event_attachments.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      mimeType: a.mime_type,
      storagePath: a.storage_path,
    })),
  };
}

async function fetchEvents(familyId: string) {
  return supabase()
    .from("events")
    .select(
      "id, created_by, assignee_id, title, date, all_day, start_time, end_time, spot_id, place, memo, " +
        "event_money(type, amount, category, ledger), event_attachments(id, kind, name, mime_type, storage_path)",
    )
    .eq("family_id", familyId)
    .order("date")
    .limit(3000)
    .returns<EventRow[]>();
}

// Storage に置くファイル名（英数字以外は _ に置き換え。元の名前は別に保存）
const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "file";
const newId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return createId("f"); // 古いブラウザ・http で開いたとき用
  }
};

export function useCalendar(familyId: string) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null); // null = 読み込み中
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    fetchEvents(familyId).then(({ data, error }) => {
      if (!active) return;
      setError(error ? describeDbError(error) : null);
      if (!error) setEvents((data ?? []).map(toEvent));
    });
    return () => {
      active = false;
    };
  }, [familyId, version]);

  useEffect(() => {
    const filter = `family_id=eq.${familyId}`;
    const channel = supabase()
      .channel(`calendar-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_money", filter }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attachments", filter }, reload)
      .subscribe();
    const stopPolling = refreshPeriodically(reload, 60_000);
    return () => {
      supabase().removeChannel(channel);
      stopPolling();
    };
  }, [familyId, reload]);

  // 予定を保存（新規・編集）。失敗したらエラー文を返す
  async function saveEvent(draft: CalendarEvent, original: CalendarEvent | null): Promise<string | null> {
    const db = supabase();
    const row = {
      assignee_id: draft.assigneeId,
      title: draft.title,
      date: draft.date,
      all_day: draft.allDay,
      start_time: draft.start,
      end_time: draft.end,
      spot_id: draft.spotId ?? null,
      place: draft.place,
      memo: draft.memo,
    };

    let id = original?.id;
    if (original) {
      const { error } = await db.from("events").update({ ...row, updated_at: new Date().toISOString() }).eq("id", original.id);
      if (error) return describeDbError(error);
    } else {
      const { data, error } = await db.from("events").insert(row).select("id").single();
      if (error || !data) return error ? describeDbError(error) : "insert failed";
      id = data.id as string;
    }

    // お金
    if (draft.money) {
      const { error } = await db.from("event_money").upsert(
        {
          event_id: id,
          type: draft.money.type,
          amount: draft.money.amount,
          category: draft.money.category,
          ledger: draft.money.ledgerId,
        },
        { onConflict: "event_id" },
      );
      if (error) return describeDbError(error);
    } else if (original?.money) {
      const { error } = await db.from("event_money").delete().eq("event_id", id);
      if (error) return describeDbError(error);
    }

    // 添付ファイル：外したもの → 削除
    const removed = (original?.attachments ?? []).filter((a) => !draft.attachments.some((d) => d.id === a.id));
    if (removed.length) {
      await db.storage.from(BUCKET).remove(removed.map((a) => a.storagePath!).filter(Boolean));
      const { error } = await db.from("event_attachments").delete().in("id", removed.map((a) => a.id));
      if (error) return describeDbError(error);
    }
    // 種類（領収書・請求書…）を変えたもの
    for (const a of draft.attachments) {
      const before = original?.attachments.find((o) => o.id === a.id);
      if (before && before.kind !== a.kind) {
        const { error } = await db.from("event_attachments").update({ kind: a.kind }).eq("id", a.id);
        if (error) return describeDbError(error);
      }
    }
    // 新しく選んだファイル → Storage に保存して記録
    for (const a of draft.attachments.filter((x) => x.file)) {
      const path = `${familyId}/${id}/${newId()}-${safeName(a.name)}`;
      const up = await db.storage.from(BUCKET).upload(path, a.file!, { contentType: a.mimeType || undefined });
      if (up.error) return up.error.message;
      const { error } = await db
        .from("event_attachments")
        .insert({ event_id: id, kind: a.kind, name: a.name, mime_type: a.mimeType, storage_path: path });
      if (error) return describeDbError(error);
    }

    reload();
    return null;
  }

  async function deleteEvent(event: CalendarEvent): Promise<string | null> {
    const db = supabase();
    const paths = event.attachments.map((a) => a.storagePath!).filter(Boolean);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    const { error } = await db.from("events").delete().eq("id", event.id);
    if (error) return describeDbError(error);
    reload();
    return null;
  }

  return { events, error, saveEvent, deleteEvent };
}

// 保存済みの添付ファイルを開くための一時URL（1時間有効）
export async function signedUrls(attachments: Attachment[]): Promise<Record<string, string>> {
  const paths = attachments.map((a) => a.storagePath).filter((p): p is string => !!p);
  if (!paths.length) return {};
  const { data } = await supabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
  const byPath = Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(
    attachments.filter((a) => a.storagePath && byPath[a.storagePath]).map((a) => [a.id, byPath[a.storagePath!]]),
  );
}

// ---------- 家族の現在地 ----------

export type SharedLocation = { lat: number; lng: number; accuracy: number; updatedAt: string };

export function useLocations(familyId: string) {
  const [locations, setLocations] = useState<Record<string, SharedLocation>>({});
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    supabase()
      .from("member_locations")
      .select("user_id, lat, lng, accuracy, updated_at")
      .eq("family_id", familyId)
      .then(({ data }) => {
        if (!active || !data) return;
        setLocations(
          Object.fromEntries(
            data.map((r) => [r.user_id, { lat: r.lat, lng: r.lng, accuracy: r.accuracy, updatedAt: r.updated_at }]),
          ),
        );
      });
    return () => {
      active = false;
    };
  }, [familyId, version]);

  useEffect(() => {
    const channel = supabase()
      .channel(`locations-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_locations", filter: `family_id=eq.${familyId}` }, reload)
      .subscribe();
    const stopPolling = refreshPeriodically(reload, 60_000);
    return () => {
      supabase().removeChannel(channel);
      stopPolling();
    };
  }, [familyId, reload]);

  // 自分の現在地を家族に共有（保存）
  async function shareMyLocation(myId: string, lat: number, lng: number, accuracy: number): Promise<string | null> {
    const { error } = await supabase()
      .from("member_locations")
      .upsert({ user_id: myId, lat, lng, accuracy, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return describeDbError(error);
    reload();
    return null;
  }

  return { locations, shareMyLocation };
}
