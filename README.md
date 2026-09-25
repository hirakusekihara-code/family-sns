# Family SNS（家族専用SNS プロトタイプ）

Next.js (App Router) + Tailwind CSS + Lucide React で作る、家族専用SNSのプロトタイプです。
今はデータベースを使わず、擬似データ（Mockデータ）で動きます。

## 画面構成

| タブ | URL | 内容 |
| --- | --- | --- |
| タイムライン | `/` | 家族の投稿・コメント・リアクション |
| マップ | `/map` | 家族の現在地、カレンダーで場所を入れた予定のポップアップ・通知、GPSでの現在地取得 |
| カレンダー | `/calendar` | 家族の予定（担当・場所・お金・添付ファイル）、家計簿・お小遣い帳、PL（収支報告書）のPDF出力 |
| チャット | `/chat` | 家族グループチャット・個別DM・音声／ビデオ通話（擬似） |

各画面の右上のボタンで、表示言語を **日本語 / English** に切り替えられます（選んだ言語はブラウザに保存されます）。

## 自分のパソコンで動かす手順

### 1. Node.js をインストール（初回のみ）

https://nodejs.org/ から **LTS版** をダウンロードしてインストールします。
ターミナル（Mac は「ターミナル」、Windows は「PowerShell」）で次を実行し、バージョンが表示されればOKです。

```bash
node -v
npm -v
```

### 2. プロジェクトを取得

```bash
git clone https://github.com/hirakusekihara-code/family-sns.git
cd family-sns
git checkout claude/family-sns-app-prototype-5tqw0k
```

### 3. 必要なライブラリをインストール（初回のみ）

```bash
npm install
```

### 4. ローカルサーバーを起動

```bash
npm run dev
```

`Ready` と表示されたら、ブラウザで http://localhost:3000 を開きます。
止めるときはターミナルで `Ctrl + C` を押します。

### 5. スマホ表示で確認するコツ

- **PCのブラウザで確認**：Chrome で `F12`（Mac は `Cmd + Option + I`）→ 左上のスマホアイコン（デバイスツールバー）をクリックすると、iPhone などの画面サイズで表示できます。
- **実機のスマホで確認**：PCとスマホを同じWi-Fiにつなぎ、`npm run dev` の表示に出る `Network: http://192.168.x.x:3000` をスマホのブラウザで開きます。

## フォルダ構成

```
src/
├── app/                  # 画面（ページ）。フォルダ名がそのままURLになります
│   ├── layout.tsx        # 全画面共通の枠（スマホ幅の枠＋ボトムナビ）
│   ├── page.tsx          # タイムライン（/）
│   ├── map/page.tsx      # マップ（/map）
│   ├── calendar/page.tsx # カレンダー（/calendar）
│   └── chat/page.tsx     # チャット（/chat）
├── components/           # 複数の画面で使い回す部品
│   ├── BottomNav.tsx     # 画面下のタブナビゲーション
│   ├── PageHeader.tsx    # 画面上部のタイトル（言語切替ボタン付き）
│   ├── common/           # 言語切替ボタンなど
│   ├── timeline/         # タイムラインの部品
│   ├── chat/             # チャット・通話の部品
│   ├── calendar/         # カレンダー・家計簿・PL出力の部品
│   └── map/              # マップ（地図・ポップアップ・GPS）の部品
└── lib/
    ├── mockData.ts       # 擬似データ（家族メンバー・場所・投稿）
    ├── chatData.ts       # チャットの擬似データ
    ├── calendarData.ts   # 予定・家計簿の擬似データと日付計算
    ├── eventStore.ts     # 予定データの保管場所（カレンダーとマップで共有）
    ├── mapData.ts        # 地図上のスポットの位置・家族の現在地（擬似データ）
    └── i18n/             # 日本語 / 英語の対訳表（messages.ts）と切替の仕組み
```

## よく使うコマンド

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発用サーバーを起動（保存すると自動で画面が更新されます） |
| `npm run build` | 本番用にビルド（エラーがないかの確認にも使えます） |
| `npm run lint` | コードの書き方チェック |
