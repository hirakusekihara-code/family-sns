/*
 * PolyVoice Live - background service worker (Manifest V3)
 *
 * 役割:
 *   1. 初期設定の保存とツールバーバッジ（ON/OFF）の更新
 *   2. content.js から受け取ったテキストの翻訳
 *
 * 翻訳を content script ではなくここで行うのは、Meet ページの CSP / CORS の
 * 影響を受けずに host_permissions で許可した翻訳 API を呼べるため。
 *
 * 翻訳エンジンの差し替え:
 *   TRANSLATION_PROVIDERS に { label, translate(text, sourceCode, targetCode) } を
 *   追加し、popup.js の PROVIDERS に同じキーを追加するだけで選択可能になる。
 *   外部 API を使う場合は manifest.json の host_permissions にドメインを追加すること。
 */

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  sourceLang: "ja-JP",
  targetLang: "en-US",
  showOriginal: true,
  provider: "google",
});

// UI 上の言語 ID → 翻訳 API 用の ISO 639 コード
const TRANSLATE_CODES = Object.freeze({
  "ja-JP": "ja",
  "en-US": "en",
  "tl-PH": "tl",
  "ceb-PH": "ceb",
});

const REQUEST_TIMEOUT_MS = 8000;
const MAX_TEXT_LENGTH = 2000;
const CACHE_LIMIT = 300;
// 選択中のプロバイダが失敗したときに一度だけ試すプロバイダ
const FALLBACK_PROVIDER = "mymemory";

async function fetchJson(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("タイムアウトしました");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const TRANSLATION_PROVIDERS = {
  // Google Translate 非公式エンドポイント（APIキー不要・テスト用途。レート制限あり、商用利用は非推奨）
  google: {
    label: "Google Translate (非公式)",
    async translate(text, source, target) {
      const params = new URLSearchParams({
        client: "gtx",
        sl: source,
        tl: target,
        dt: "t",
        q: text,
      });
      const data = await fetchJson(`https://translate.googleapis.com/translate_a/single?${params}`);
      if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error("予期しないレスポンス形式です");
      }
      return data[0]
        .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
        .filter(Boolean)
        .join("");
    },
  },

  // MyMemory 無料 API（匿名利用は 1 日あたりの文字数上限あり）
  mymemory: {
    label: "MyMemory (無料API)",
    async translate(text, source, target) {
      const params = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
      const data = await fetchJson(`https://api.mymemory.translated.net/get?${params}`);
      const status = Number(data && data.responseStatus);
      const translated = data && data.responseData && data.responseData.translatedText;
      if (status !== 200 || !translated) {
        throw new Error((data && data.responseDetails) || `MyMemory error (${status})`);
      }
      return translated;
    },
  },

  // ネットワークを使わない動作確認用
  mock: {
    label: "Mock (オフライン確認用)",
    async translate(text, source, target) {
      return `[${source}→${target}] ${text}`;
    },
  },
};

// 直近の翻訳結果のキャッシュ（Map の挿入順を利用した簡易 LRU）
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

async function translate({ text, source, target, provider }) {
  if (typeof text !== "string" || !text.trim()) throw new Error("テキストが空です");
  if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH);

  const sourceCode = TRANSLATE_CODES[source];
  const targetCode = TRANSLATE_CODES[target];
  if (!sourceCode || !targetCode) throw new Error(`未対応の言語です: ${source} → ${target}`);

  const primary = TRANSLATION_PROVIDERS[provider] ? provider : DEFAULT_SETTINGS.provider;
  const cacheKey = `${primary}|${sourceCode}|${targetCode}|${text}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const chain = [primary];
  if (primary !== "mock" && primary !== FALLBACK_PROVIDER) chain.push(FALLBACK_PROVIDER);

  let lastError = null;
  for (const name of chain) {
    try {
      const translated = await TRANSLATION_PROVIDERS[name].translate(text, sourceCode, targetCode);
      if (!translated) throw new Error("翻訳結果が空です");
      const result = { text: translated, provider: name };
      cacheSet(cacheKey, result);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[PolyVoice] provider "${name}" failed:`, err);
    }
  }
  throw lastError || new Error("翻訳に失敗しました");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "PVL_TRANSLATE") return false;

  translate(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }));

  // 非同期で sendResponse を呼ぶため true を返してチャネルを開いたままにする
  return true;
});

async function updateBadge(enabled) {
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#1a73e8" : "#5f6368" });
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
}

async function initSettings() {
  // 既存の値を保ちつつ、未設定のキーだけ既定値で埋める
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set(current);
  await updateBadge(Boolean(current.enabled));
}

chrome.runtime.onInstalled.addListener(() => {
  initSettings().catch((err) => console.error("[PolyVoice] init failed:", err));
});

chrome.runtime.onStartup.addListener(() => {
  initSettings().catch((err) => console.error("[PolyVoice] init failed:", err));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled) {
    updateBadge(Boolean(changes.enabled.newValue)).catch(() => {});
  }
});
