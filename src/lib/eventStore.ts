"use client";

import { useSyncExternalStore } from "react";
import { buildMockEvents, toDateKey, type CalendarEvent } from "./calendarData";

// 予定データの保管場所（カレンダーとマップで共有）
// 画面を移動しても残りますが、ページを再読み込みすると初期状態に戻ります。

let events: CalendarEvent[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: CalendarEvent[] = [];

function getEvents(): CalendarEvent[] {
  if (!events) events = buildMockEvents(toDateKey(new Date()));
  return events;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function updateEvents(updater: (prev: CalendarEvent[]) => CalendarEvent[]) {
  events = updater(getEvents());
  listeners.forEach((l) => l());
}

export function useEvents(): CalendarEvent[] {
  // カレンダーとマップはブラウザ側だけで表示するので、サーバー用の値は使われません
  return useSyncExternalStore(subscribe, getEvents, () => EMPTY);
}
