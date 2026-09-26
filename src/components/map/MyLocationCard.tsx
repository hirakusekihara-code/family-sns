"use client";

import { useState } from "react";
import { ExternalLink, Loader2, LocateFixed } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/useI18n";

type State =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "done"; lat: number; lng: number; accuracy: number }
  | { status: "error"; messageKey: MessageKey };

type Props = {
  shareEnabled: boolean; // プロフィールの「位置情報を家族と共有する」
  onLocated: (lat: number, lng: number, accuracy: number) => Promise<string | null>; // 家族に共有（保存）
};

// ブラウザの位置情報（GPS）で実際の現在地を取得し、共有がオンなら家族に共有する
export default function MyLocationCard({ shareEnabled, onLocated }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: "idle" });
  const [shareResult, setShareResult] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", messageKey: "map.locUnsupported" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const accuracy = Math.round(pos.coords.accuracy);
        setState({ status: "done", lat, lng, accuracy });
        if (shareEnabled) {
          const error = await onLocated(lat, lng, accuracy);
          setShareResult(error ?? t("map.sharedDone"));
        }
      },
      (err) =>
        setState({
          status: "error",
          messageKey: err.code === err.PERMISSION_DENIED ? "map.locDenied" : "map.locUnavailable",
        }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{t("map.myLocation")}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{t("map.myLocationNote")}</p>

      {state.status === "done" && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="tabular-nums">
            {t("map.lat")} {state.lat.toFixed(5)} / {t("map.lng")} {state.lng.toFixed(5)}
          </p>
          <p className="text-xs text-slate-500">{t("map.accuracy", { m: state.accuracy })}</p>
          <p className={`mt-1 text-xs ${shareEnabled ? "text-emerald-700" : "text-slate-500"}`} role="status">
            {shareEnabled ? shareResult : t("map.shareOffNote")}
          </p>
          <a
            href={`https://www.google.com/maps?q=${state.lat},${state.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600"
          >
            {t("map.openInMaps")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
      {state.status === "error" && <p className="mt-3 text-sm text-rose-600">{t(state.messageKey)}</p>}

      <button
        type="button"
        onClick={locate}
        disabled={state.status === "locating"}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-60"
      >
        {state.status === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        {state.status === "locating" ? t("map.locating") : t("map.getLocation")}
      </button>
    </section>
  );
}
