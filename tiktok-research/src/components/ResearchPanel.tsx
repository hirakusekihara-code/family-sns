"use client";
import { useMemo } from "react";
import { Clock, Hash, TrendingUp } from "lucide-react";
import { compact, percent, research } from "@/lib/stats";
import type { Profile, Video } from "@/lib/types";
import { formatDate } from "./VideoCard";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="tr-bars" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {values.map((v, i) => (
        <div key={i} className="tr-bars__col" title={`${labels[i]}：${v}件`}>
          <div className="tr-bars__bar" style={{ height: `${(v / max) * 100}%` }} />
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function ResearchPanel({ videos, profile, onOpen }: { videos: Video[]; profile: Profile; onOpen: (v: Video) => void }) {
  const r = useMemo(() => research(videos, profile), [videos, profile]);
  const hourLabels = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? String(h) : ""));
  const bestDay = r.weekday.indexOf(Math.max(...r.weekday));
  const bestHour = r.hours.indexOf(Math.max(...r.hours));
  // 再生数の推移（古い→新しい、最大60件）
  const trend = useMemo(() => [...videos].filter((v) => v.createdAt).sort((a, b) => a.createdAt - b.createdAt).slice(-60), [videos]);
  const trendMax = Math.max(...trend.map((v) => v.views), 1);

  const kpis: [string, string, string?][] = [
    ["平均再生数", compact(r.avgViews), `中央値 ${compact(r.medianViews)}`],
    ["エンゲージメント率", percent(r.engagementRate), "(いいね+コメント+シェア+保存)÷再生"],
    ["平均いいね", compact(r.avgLikes), `コメント ${compact(r.avgComments)} / シェア ${compact(r.avgShares)}`],
    ["再生÷フォロワー", r.viewsPerFollower ? percent(r.viewsPerFollower, 1) : "—", "平均再生数がフォロワーの何%か"],
    ["投稿ペース", r.postsPerWeek ? `週 ${r.postsPerWeek.toFixed(1)} 本` : "—", r.firstPost ? `${formatDate(r.firstPost)} 〜 ${formatDate(r.lastPost)}` : ""],
    ["平均の長さ", r.avgDuration ? `${Math.round(r.avgDuration)} 秒` : "—", `合計再生 ${compact(r.totalViews)}`],
  ];

  return (
    <section className="tr-card">
      <h3 className="tr-section-title">
        <TrendingUp size={18} /> リサーチ結果 <small>読み込んだ {r.count} 件から計算</small>
      </h3>
      <div className="tr-kpis">
        {kpis.map(([label, value, note]) => (
          <div key={label} className="tr-kpi">
            <span className="tr-kpi__label">{label}</span>
            <b className="tr-kpi__value">{value}</b>
            {note && <span className="tr-kpi__note">{note}</span>}
          </div>
        ))}
      </div>

      {trend.length > 1 && (
        <div className="tr-block">
          <h4>再生数の推移（古い → 新しい）</h4>
          <div className="tr-trend" role="img" aria-label="投稿ごとの再生数">
            {trend.map((v) => (
              <button
                type="button"
                key={v.id}
                className="tr-trend__bar"
                style={{ height: `${Math.max((v.views / trendMax) * 100, 2)}%` }}
                title={`${formatDate(v.createdAt)}：${compact(v.views)} 再生\n${v.title}`}
                onClick={() => onOpen(v)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="tr-two">
        <div className="tr-block">
          <h4>
            <Clock size={15} /> 投稿の曜日 {r.count > 0 && <small>最多：{WEEK[bestDay]}曜</small>}
          </h4>
          <Bars values={r.weekday} labels={WEEK} />
        </div>
        <div className="tr-block">
          <h4>
            <Clock size={15} /> 投稿の時間帯 {r.count > 0 && <small>最多：{bestHour}時台（端末の時刻）</small>}
          </h4>
          <Bars values={r.hours} labels={hourLabels} />
        </div>
      </div>

      <div className="tr-two">
        <div className="tr-block">
          <h4>
            <Hash size={15} /> よく使うハッシュタグ
          </h4>
          {r.hashtags.length ? (
            <table className="tr-table">
              <thead>
                <tr>
                  <th>タグ</th>
                  <th>回数</th>
                  <th>平均再生</th>
                </tr>
              </thead>
              <tbody>
                {r.hashtags.map((h) => (
                  <tr key={h.tag}>
                    <td>{h.tag}</td>
                    <td>{h.count}</td>
                    <td>{compact(h.avgViews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="tr-muted">ハッシュタグは使われていません</p>
          )}
        </div>
        <div className="tr-block">
          <h4>
            <TrendingUp size={15} /> 再生数トップ5
          </h4>
          <ol className="tr-top">
            {r.top.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => onOpen(v)}>
                  {v.cover && <img src={v.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />}
                  <span className="tr-top__text">
                    <span className="tr-top__title">{v.title || "（タイトルなし）"}</span>
                    <span className="tr-muted">
                      {compact(v.views)} 再生 ・ {formatDate(v.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
