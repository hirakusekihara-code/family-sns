# PolyVoice Live (Phase 1 / MVP)

Google Meet 上で自分の発話をリアルタイムに音声認識し、相手の言語へ翻訳してフローティング字幕として表示する Chrome 拡張機能（Manifest V3）です。
サーバー不要で、ブラウザ標準の Web Speech API とクライアントサイド処理のみで動作します。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | MV3 定義。`meet.google.com` への content script 注入と翻訳 API の host 許可 |
| `content.js` | 字幕オーバーレイの挿入、SpeechRecognition の制御（途中結果の表示・確定時の翻訳依頼・自動再開・言語フォールバック） |
| `background.js` | Service Worker。翻訳プロバイダ（差し替え可能）、キャッシュ、初期設定、ツールバーバッジ |
| `popup.html` / `popup.js` | 翻訳元・翻訳先・翻訳エンジン・原文表示・ON/OFF の設定画面（MV3 はインラインスクリプト禁止のため JS を分離） |
| `styles.css` | 画面下部中央に固定表示する半透明の字幕 UI（`#polyvoice-live-root` 配下に限定） |

## インストール（開発者モード）

1. `chrome://extensions` を開き、右上の「デベロッパーモード」を ON にする
2. 「パッケージ化されていない拡張機能を読み込む」→ このフォルダ（`extensions/polyvoice-live`）を選択
3. Google Meet の会議に参加し、ツールバーの PolyVoice Live アイコンから言語を選んで ON にする

## 動作の流れ

```
マイク → SpeechRecognition (continuous + interimResults)
        ├─ 途中結果 → 字幕の「認識中」行にそのまま表示
        └─ isFinal   → background.js へ PVL_TRANSLATE → 翻訳結果を字幕に表示
```

- Chrome は無音が続くと認識を自動終了するため、ON の間は `onend` で自動再開します（エラー時は指数バックオフ）。
- 会議画面（`/xxx-xxxx-xxx`）にいるときだけ認識を開始します。待機画面では動作しません。

## 言語と音声認識コード

| UI 上の言語 | 音声認識の候補（先頭から試行） | 翻訳コード |
| --- | --- | --- |
| 日本語 `ja-JP` | `ja-JP` | `ja` |
| 英語 `en-US` | `en-US` | `en` |
| タガログ語 `tl-PH` | `fil-PH` → `tl-PH` | `tl` |
| セブアノ語 `ceb-PH` | `ceb-PH` → `fil-PH` → `en-US` | `ceb` |

`language-not-supported` エラーが返った場合、次の候補へ自動でフォールバックし、字幕ヘッダーに代替中の言語を表示します。
Chrome がエラーを返さずに認識結果が空になるケースは検知できないため、セブアノ語で文字が出ない場合はタガログ語を選択してください。

## 翻訳エンジンの差し替え

`background.js` の `TRANSLATION_PROVIDERS` にエントリを追加し、`popup.js` の `PROVIDERS` に同じキーを追加します。

```js
myApi: {
  label: "社内翻訳API",
  async translate(text, source, target) {
    const res = await fetch("https://example.com/translate", { method: "POST", body: JSON.stringify({ text, source, target }) });
    return (await res.json()).text;
  },
},
```

外部ドメインを使う場合は `manifest.json` の `host_permissions` にも追加してください。
選択したプロバイダが失敗した場合は MyMemory に一度だけフォールバックします（Mock 選択時を除く）。

## 既知の制約（MVP）

- 認識対象は**自分のマイク入力のみ**です。相手の音声（タブ音声）の認識は `chrome.tabCapture` + offscreen document を使うフェーズ2の範囲です。
- Meet でミュートしていても、拡張機能はマイク入力を認識します。
- スピーカーから出た相手の声を拾わないよう、ヘッドセットの使用を推奨します。
- Web Speech API の音声は Google の認識サーバーに送信されます。
- Google Translate 非公式エンドポイントはテスト用途向けで、レート制限や仕様変更の可能性があります。本番では公式 API などへ差し替えてください。
