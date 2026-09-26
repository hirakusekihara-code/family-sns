"use client";

import { getSpot, spots } from "@/lib/mockData";
import { spotPositions } from "@/lib/mapData";
import type { Member } from "@/lib/family";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/common/MemberAvatar";

export type Selection = { kind: "spot" | "member"; id: string } | null;
export type Pin = { member: Member; spotId: string }; // 家族のアイコンを置くスポット（今の予定の場所）

type Props = {
  eventCountBySpot: Record<string, number>;
  pins: Pin[];
  youId: string;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  children?: React.ReactNode; // 地図の上に重ねるポップアップ
};

// イラスト風の地図 ＋ スポット・家族のアイコン
export default function MapCanvas({ eventCountBySpot, pins, youId, selection, onSelect, children }: Props) {
  const { t, spotName } = useI18n();

  // 同じ場所にいる家族は少しずつ横にずらして表示
  const indexAtSpot = new Map<string, number>();

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#eaf1e4]">
      <MapIllustration />

      {/* スポット */}
      {spots.map((spot) => {
        const pos = spotPositions[spot.id];
        if (!pos) return null;
        const count = eventCountBySpot[spot.id] ?? 0;
        const selected = selection?.kind === "spot" && selection.id === spot.id;
        return (
          <button
            key={spot.id}
            type="button"
            onClick={() => onSelect(selected ? null : { kind: "spot", id: spot.id })}
            aria-pressed={selected}
            aria-label={`${spotName(spot)}${count ? ` (${t("map.eventsWithPlace", { n: count })})` : ""}`}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-md transition ${
                selected ? "scale-110 ring-2 ring-indigo-500" : ""
              }`}
            >
              {spot.emoji}
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {count}
                </span>
              )}
            </span>
            <span className="mt-0.5 whitespace-nowrap rounded bg-white/85 px-1 text-[10px] font-medium text-slate-700">
              {spotName(spot)}
            </span>
          </button>
        );
      })}

      {/* 家族（今の予定の場所） */}
      {pins.map(({ member, spotId }) => {
        const pos = spotPositions[spotId];
        if (!pos || !getSpot(spotId)) return null;
        const i = indexAtSpot.get(spotId) ?? 0;
        indexAtSpot.set(spotId, i + 1);
        const selected = selection?.kind === "member" && selection.id === member.id;
        // 予定件数のバッジ（右上）を隠さないよう、左に寄せて並べる
        const shift = i * 26 - 16;
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(selected ? null : { kind: "member", id: member.id })}
            aria-pressed={selected}
            aria-label={`${member.name}: ${spotName(getSpot(spotId)!)}`}
            className="absolute z-20 flex flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(calc(-50% + ${shift}px), -118%)` }}
          >
            <span className={`relative rounded-full p-0.5 shadow-lg transition ${selected ? "scale-110 bg-indigo-500" : "bg-white"}`}>
              <Avatar member={member} size="sm" />
            </span>
            {member.id === youId && (
              <span className="mt-0.5 rounded-full bg-slate-900 px-1.5 text-[9px] font-semibold text-white">
                {t("common.you")}
              </span>
            )}
          </button>
        );
      })}

      <p className="absolute left-2 top-2 z-10 rounded bg-white/80 px-1.5 text-[10px] text-slate-500">{t("map.illustration")}</p>

      {children}
    </div>
  );
}

// 地図のイラスト（川・道路・公園・線路など）
function MapIllustration() {
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      {[
        [20, 150, 50, 36], [80, 150, 38, 36], [150, 220, 44, 34], [205, 220, 60, 34], [150, 270, 44, 40],
        [20, 215, 40, 50], [70, 215, 45, 50], [230, 110, 50, 30], [150, 110, 40, 30], [30, 350, 60, 40],
        [110, 345, 25, 45], [230, 60, 60, 36], [175, 60, 40, 36],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#dde5d4" />
      ))}
      <rect x="175" y="290" width="120" height="100" rx="14" fill="#cbe6bb" />
      {[[190, 305], [280, 310], [185, 380], [285, 378], [240, 385]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" fill="#9fd08a" />
      ))}
      <rect x="20" y="55" width="75" height="55" rx="8" fill="#f1e2c6" />
      <path d="M -10 130 C 80 110, 140 175, 310 150" stroke="#a7d3f2" strokeWidth="20" fill="none" />
      <path d="M -10 130 C 80 110, 140 175, 310 150" stroke="#c4e3f8" strokeWidth="8" fill="none" />
      <line x1="0" y1="35" x2="300" y2="35" stroke="#94a3b8" strokeWidth="4" />
      <line x1="0" y1="35" x2="300" y2="35" stroke="#fff" strokeWidth="2" strokeDasharray="8 8" />
      {[
        ["M 0 205 L 300 205", 12],
        ["M 130 0 L 130 400", 12],
        ["M 130 205 L 245 50", 9],
        ["M 0 330 L 300 330", 9],
        ["M 215 205 L 215 400", 8],
        ["M 60 205 L 60 400", 7],
      ].map(([d, w], i) => (
        <g key={i}>
          <path d={d as string} stroke="#d6d3cb" strokeWidth={(w as number) + 3} fill="none" strokeLinecap="round" />
          <path d={d as string} stroke="#ffffff" strokeWidth={w as number} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
