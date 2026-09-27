# PolyVoice Live (Phase 2)

Google Meet 上で**自分の発話（マイク）と相手の発話（Meet タブの音声）**をリアルタイムに認識し、それぞれ相手・自分の言語へ翻訳してフローティング字幕として表示する Chrome 拡張機能（Manifest V3）です。
Gemini API キーを設定すると、セブアノ語（Bisaya / Bislish）・タガログ語（Taglish）の口語やコードスイッチングに強い LLM 翻訳に切り替わります。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | MV3 定義。`tabCapture` / `offscreen` 権限、Meet への content script 注入、翻訳 API・Gemini API の host 許可 |
| `languages.js` | 言語定義と設定の既定値（content / popup / offscreen / background で共有） |
| `content.js` | 字幕オーバーレイ、自分のマイク認識、相手の認識イベントの表示（You = 青 / Partner = 緑） |
| `background.js` | Service Worker。ハイブリッド翻訳（Gemini ⇄ 無料 API）、LLM プロンプトの枠組み、会話コンテキスト、相手音声キャプチャの制御と中継 |
| `offscreen.html` / `offscreen.js` | Meet タブ音声の取得・再生、相手の音声認識（Web Speech にタブ音声を入力 / Gemini 用の発話区間切り出し） |
| `popup.html` / `popup.js` | 言語・ON/OFF・相手音声キャプチャ・翻訳エンジン・Gemini API キー・モデル・用語集の設定 |
| `styles.css` | 画面下部中央に固定表示する半透明の双方向字幕 UI |

## インストール / 更新

1. `chrome://extensions` → 「デベロッパーモード」ON
2. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択（フェーズ1から更新する場合は、ファイルを差し替えて拡張機能カードの ↻ 再読み込み）
3. 開いている Meet のタブを再読み込み

## 使い方

1. Meet の会議画面でツールバーの PolyVoice Live アイコンを開く
2. **自分の言語**と**相手の言語**を選び、右上のトグルを ON（自分の声の字幕）
3. **「相手の音声キャプチャを開始」**を押す（相手の声の字幕。Chrome にタブ共有中の表示が出ます）
4. 高精度翻訳を使う場合は「Gemini API 設定」でキーを保存し、「接続テスト」で確認

## 処理の流れ

```
自分: マイク ─ Web Speech (content.js) ─ 途中結果を表示 ─ 確定 ─┐
                                                              ├─ background.js 翻訳 ─ 字幕 (You, 青)
相手: Meetタブ音声 ─ tabCapture ─ offscreen.js                 │
        ├ browser: SpeechRecognition.start(audioTrack) ─ 確定 ─┘  → 字幕 (Partner, 緑)
        └ gemini : 音量VADで発話区間を切り出し → 16kHz WAV → Gemini で文字起こし+翻訳 → 字幕 (Partner, 緑)
```

- tabCapture 中はタブの音がミュートされるため、offscreen で再生し直しています（相手の声はそのまま聞こえます）。
- 相手の認識エンジン「自動」: 相手がセブアノ語で API キーがある場合は Gemini、それ以外は Web Speech。Web Speech がタブ音声入力に未対応・接続不可の場合は、キーがあれば Gemini へ自動で切り替えます。
- 字幕を OFF（トグル / 字幕の ×）にすると、相手の音声キャプチャも停止します。

## ハイブリッド翻訳

| 翻訳エンジン設定 | API キーあり | API キーなし |
| --- | --- | --- |
| 自動（既定） | Gemini → Google 非公式 → MyMemory | Google 非公式 → MyMemory |
| Gemini 高精度 | Gemini → Google 非公式 → MyMemory | Google 非公式 → MyMemory |
| Google / MyMemory / Mock | 選択したもの（Google は MyMemory へフォールバック） | 同左 |

- Gemini には直近 8 発話の会話（You / Partner と訳文）を文脈として渡し、主語の省略・代名詞・音声認識の誤りを補正させます。
- API キーは `chrome.storage.local`（同期されない）に保存され、`generativelanguage.googleapis.com` への `x-goog-api-key` ヘッダーにのみ使われます。
- モデルは popup で変更できます（既定・推奨 `gemini-3.5-flash-lite`）。「利用可能なモデルを取得」で、その API キーで使えるモデル一覧を Gemini API から取得して候補に表示します。
- Gemini 3.x 以降には `temperature` / `thinkingConfig` を送らず既定値で動かします（2.x 系を指定した場合のみ temperature 0.2・2.5 Flash 系は思考無効）。
- 選択中のモデルが提供終了で 404 になった場合は、エラーメッセージで案内された後継モデル（なければ既定モデル）で 1 回だけ再試行し、成功したら設定を自動更新します。
- 設定 v3 への移行時に、新規ユーザー向けに提供終了した `gemini-1.x` / `gemini-2.x` の設定は既定モデルに置き換えます。

## LLM プロンプトの枠組み（`background.js`）

- `buildSystemPrompt()` … 共通ルール（ASR 誤り補正、フィラー除去、コードスイッチングの扱い、数値・固有名詞の保持、字幕向けの簡潔さ、プロンプトインジェクション対策）＋ 言語別プロファイル ＋ 用語集
- `LANGUAGE_PROFILES` … 言語ごとに `notes`（翻訳元として読むときの注意）と `style`（翻訳先として書くときの文体）を定義
  - **Cebuano (Bisaya / Bislish)**: 英語混じり、man/ba/gyud/lagi/bitaw/diay などの談話標識、タガログ語と混同しやすい基本語、fil-PH / en-US 認識器による綴り崩れの復元、表記ゆれ
  - **Tagalog (Taglish)**: 英語混じり、英語語幹 + タガログ語接辞（nag-check, i-send）、po/opo などの丁寧さ、口語綴り
  - **Japanese / English**: 主語省略の補完、ビジネス通話向けの丁寧体、非ネイティブ英語の意図解釈
- `buildUserPrompt()` … 会話コンテキスト、話者（You / Partner）、翻訳方向、発話本文
- 音声モードでは `transcript`（話されたままの文字起こし）と `translation` を JSON Schema で返させます
- 言語を追加する場合は `languages.js` の `LANGUAGES` と `LANGUAGE_PROFILES` に 1 エントリずつ追加します

## 既知の制約

- 自分のマイク認識（Meet ページ内）と相手のタブ音声認識（offscreen）を同時に Web Speech で動かせるかは Chrome のバージョンや環境に依存します。相手側がエラーになる場合は Gemini 音声認識を選んでください。
- Gemini 音声認識は発話の区切り（約 0.7 秒の無音）ごとに送るため、途中経過は表示されず 1〜3 秒程度遅れて字幕になります。
- スピーカーで聞くと相手の声をマイクが拾い、自分の字幕として二重に出ます。ヘッドセットを使ってください。
- Web Speech API の音声は Google の認識サーバーに、Gemini モードの音声・テキストは Gemini API に送信されます。
- Google Translate 非公式エンドポイントはテスト用途向けです。本番では公式 API などに差し替えてください。
