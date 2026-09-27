/*
 * PolyVoice Live - 共有定義
 * content script / popup / offscreen document / service worker (importScripts) の
 * すべてから読み込まれるため、ES Module ではなくグローバル (globalThis.PVL_SHARED) で公開する。
 */
(function (root) {
  "use strict";

  if (root.PVL_SHARED) return;

  // speech: Web Speech API に渡す言語コードの候補。先頭から試し、
  //         "language-not-supported" が返ったら次の候補へフォールバックする。
  //         Chrome はタガログ語を "fil-PH" として扱うため tl-PH より先に試す。
  //         セブアノ語は Chrome の音声認識で未対応のことが多いため fil-PH → en-US へ落とす。
  // translate: 無料翻訳 API (Google 非公式 / MyMemory) 用の ISO 639 コード
  // name: LLM プロンプトで使う言語名
  const LANGUAGES = Object.freeze({
    "ja-JP": Object.freeze({
      label: "日本語",
      short: "JA",
      name: "Japanese",
      translate: "ja",
      speech: Object.freeze(["ja-JP"]),
    }),
    "en-US": Object.freeze({
      label: "English",
      short: "EN",
      name: "English",
      translate: "en",
      speech: Object.freeze(["en-US"]),
    }),
    "tl-PH": Object.freeze({
      label: "Tagalog",
      short: "TL",
      name: "Tagalog (Filipino)",
      translate: "tl",
      speech: Object.freeze(["fil-PH", "tl-PH"]),
    }),
    "ceb-PH": Object.freeze({
      label: "Cebuano (Bisaya)",
      short: "CEB",
      name: "Cebuano (Bisaya / Binisaya)",
      translate: "ceb",
      speech: Object.freeze(["ceb-PH", "fil-PH", "en-US"]),
    }),
  });

  const SETTINGS_VERSION = 3;

  // chrome.storage.sync に保存する設定（API キーは同期させないため storage.local 側に置く）
  const DEFAULT_SETTINGS = Object.freeze({
    settingsVersion: SETTINGS_VERSION,
    enabled: false,
    captureSelf: true, // 自分のマイク音声を認識する
    sourceLang: "ja-JP", // 自分の言語
    targetLang: "en-US", // 相手の言語
    showOriginal: true,
    provider: "auto", // auto | gemini | google | mymemory | mock
    partnerEngine: "auto", // auto | browser | gemini
    geminiModel: "gemini-3.5-flash-lite",
    glossary: "", // 1 行 1 件「原語 = 訳語」
  });

  root.PVL_SHARED = Object.freeze({ LANGUAGES, DEFAULT_SETTINGS, SETTINGS_VERSION });
})(globalThis);
