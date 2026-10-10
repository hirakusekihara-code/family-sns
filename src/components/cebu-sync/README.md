# Cebu Sync — Phase 1（簡易版）

セブ島オフィス（スタッフ5名・管理者不在）を日本から遠隔管理するための業務マネジメント Web アプリのプロトタイプ。

- `CebuSync.tsx` — 単一ファイルの React + TypeScript コンポーネント（Tailwind CSS / lucide-react）。default export `CebuSyncApp`。
- 外部依存は `react` と `lucide-react` のみ。データはすべてメモリ上のモック（GPS・Teams・CSV はシミュレーション）。
- Claude Artifacts（React）にそのまま貼り付けてプレビューできます。

## 起動方法

Next.js アプリの `/cebu-sync` ページとして組み込まれています（ログイン不要・全幅表示）。

- Vercel: デプロイ（プレビュー）URL の末尾に `/cebu-sync` を付けて開く
- ローカル: `npm run dev` → http://localhost:3000/cebu-sync

Family SNS のスマホ枠レイアウト・ログイン画面とは別にするため、`src/app/(family)` と `src/app/(cebu)` の 2 つのルートグループに分け、それぞれにルートレイアウトを置いています（URL は従来どおり）。

## 主な機能

| タブ | 内容 |
| --- | --- |
| 🏢 Dashboard | GPS出勤打刻（半径50mジオフェンス）・休憩・退勤、本日のマイルストーン、アラート、5名のリアルタイム勤怠 |
| 📌 Tasks & Approval | タスク一覧・マイルストーン・遅延検知・ワンタップBlocker申告・証跡添付、GM/HQO承認トレイ、＋Add Task |
| 🚗 Transit & Visits | 出発 → 到着チェックイン → 領収書添付＆帰社、チェックイン履歴マップ（モック） |
| 🎓 Students & Lessons | 学生登録/リスト、対面6コマ時間割（担当スタッフのマイルストーンへ自動追加）、Teams予約（回数自動カウント） |
| 📊 Work Log (DTR) | 今日/今週/今月の出退勤・休憩・外出・実働集計、CSVエクスポート |

上部のロールバーで `👤 Staff`（▾でスタッフ切替）/ `👔 GM` / `🏦 HQO` を1クリックで切り替えられます。
