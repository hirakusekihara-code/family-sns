"use client";
import { useState } from "react";
import { CircleAlert, CircleCheck, ChevronDown, ChevronUp, Download, LoaderCircle, Square, X } from "lucide-react";
import type { JobState } from "./useDownloads";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`;

// 画面右下の保存キュー
export default function DownloadPanel({ jobs, onStop, onClear }: { jobs: JobState[]; onStop: () => void; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!jobs.length) return null;
  const done = jobs.filter((j) => j.status === "done").length;
  const active = jobs.some((j) => j.status === "running" || j.status === "waiting");
  const current = jobs.find((j) => j.status === "running");
  const pct = current && current.total ? Math.round((current.loaded / current.total) * 100) : null;

  return (
    <aside className="tr-dl" aria-live="polite">
      <div className="tr-dl__head">
        <span>
          <Download size={16} /> 保存 {done}/{jobs.length}
          {current && <> ・ {pct !== null ? `${pct}%` : mb(current.loaded)}</>}
        </span>
        <span className="tr-dl__actions">
          {active ? (
            <button type="button" onClick={onStop} title="すべて止める">
              <Square size={14} /> 止める
            </button>
          ) : (
            <button type="button" onClick={onClear} title="閉じる">
              <X size={14} /> 閉じる
            </button>
          )}
          <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "開く" : "たたむ"}>
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </span>
      </div>
      {current && (
        <div className="tr-dl__track">
          <div className={`tr-dl__fill${pct === null ? " tr-dl__fill--indeterminate" : ""}`} style={pct !== null ? { width: `${pct}%` } : undefined} />
        </div>
      )}
      {!collapsed && (
        <ul className="tr-dl__list">
          {jobs.map((j) => (
            <li key={j.key} className={`tr-dl__item tr-dl__item--${j.status}`}>
              {j.status === "running" ? (
                <LoaderCircle size={14} className="tr-spin" />
              ) : j.status === "done" ? (
                <CircleCheck size={14} />
              ) : j.status === "error" ? (
                <CircleAlert size={14} />
              ) : (
                <span className="tr-dl__dot" />
              )}
              <span className="tr-dl__label" title={j.label}>
                {j.label}
              </span>
              <span className="tr-dl__state">
                {j.link ? (
                  <a href={j.link} target="_blank" rel="noreferrer noopener" title="開いた画面で「︙」または長押し →「保存」">
                    開いて保存
                  </a>
                ) : j.status === "running" ? (
                  j.total ? `${Math.round((j.loaded / j.total) * 100)}%` : mb(j.loaded)
                ) : j.status === "done" ? (
                  mb(j.total)
                ) : j.status === "waiting" ? (
                  "待機中"
                ) : (
                  j.message
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
