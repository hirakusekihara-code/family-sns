/*
 * PolyVoice Live - popup
 * Manifest V3 の CSP ではインラインスクリプトが禁止されているため、popup.html から分離している。
 * 設定は chrome.storage.sync、Gemini API キーは chrome.storage.local（端末外へ同期しない）に保存する。
 */

const { LANGUAGES, DEFAULT_SETTINGS } = globalThis.PVL_SHARED;

// background.js の TRANSLATION_PROVIDERS / resolveProviderChain とキーを揃える
const PROVIDERS = [
  { id: "auto", label: "自動（キーあり→Gemini / なし→無料）" },
  { id: "gemini", label: "Gemini 高精度（失敗時は無料翻訳）" },
  { id: "google", label: "Google Translate（非公式・無料）" },
  { id: "mymemory", label: "MyMemory（無料API）" },
  { id: "mock", label: "Mock（オフライン確認用）" },
];

const PARTNER_ENGINES = [
  { id: "auto", label: "自動（セブアノ語はキーがあれば Gemini）" },
  { id: "browser", label: "Web Speech（途中経過あり・無料）" },
  { id: "gemini", label: "Gemini 音声認識（高精度・要APIキー）" },
];

const ENGINE_LABELS = { browser: "Web Speech", gemini: "Gemini" };
const MAX_GLOSSARY_LENGTH = 4000;

const $ = (id) => document.getElementById(id);

let activeTab = null;
let hasKey = false;
let partnerState = { active: false, kind: "off", message: "", engine: null, tabId: null };

function fillSelect(select, items) {
  select.replaceChildren(
    ...items.map(({ id, label }) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      return option;
    }),
  );
}

function languageItems() {
  return Object.entries(LANGUAGES).map(([id, entry]) => ({ id, label: `${entry.label} (${id})` }));
}

function isMeetTab(tab) {
  return Boolean(tab && tab.url && tab.url.startsWith("https://meet.google.com/"));
}

function setStatus(elId, textId, kind, text) {
  $(elId).dataset.state = kind;
  $(textId).textContent = text;
}

// ---------------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------------

function renderSettings(settings) {
  $("enabled").checked = Boolean(settings.enabled);
  $("captureSelf").checked = Boolean(settings.captureSelf);
  $("sourceLang").value = settings.sourceLang;
  $("targetLang").value = settings.targetLang;
  $("provider").value = settings.provider;
  $("partnerEngine").value = settings.partnerEngine;
  $("showOriginal").checked = Boolean(settings.showOriginal);
  if (document.activeElement !== $("geminiModel")) $("geminiModel").value = settings.geminiModel;
  if (document.activeElement !== $("glossary")) $("glossary").value = settings.glossary;

  $("noteCebuano").hidden = settings.sourceLang !== "ceb-PH" && settings.targetLang !== "ceb-PH";
  $("noteSame").hidden = settings.sourceLang !== settings.targetLang;
  renderMode(settings);
}

function renderMode(settings) {
  const badge = $("modeBadge");
  const usesGemini = hasKey && (settings.provider === "auto" || settings.provider === "gemini");
  badge.textContent = usesGemini ? "高精度 (Gemini)" : settings.provider === "mock" ? "Mock" : "無料翻訳";
  badge.classList.toggle("ok", usesGemini);
}

function renderKeyStatus(message, kind) {
  if (message) {
    setStatus("keyStatus", "keyStatusText", kind, message);
    return;
  }
  setStatus(
    "keyStatus",
    "keyStatusText",
    hasKey ? "listening" : "off",
    hasKey ? "キー設定済み: 高精度翻訳を使用します" : "未設定: 無料翻訳（Google 非公式 / MyMemory）を使用します",
  );
}

function renderPartner() {
  const onMeet = isMeetTab(activeTab);
  const otherTab = partnerState.active && activeTab && partnerState.tabId !== activeTab.id;
  const button = $("partnerToggle");

  button.disabled = !onMeet && !partnerState.active;
  button.textContent = partnerState.active ? "相手の音声キャプチャを停止" : "相手の音声キャプチャを開始";
  button.classList.toggle("stop", partnerState.active);

  let text;
  let kind = partnerState.kind || "off";
  if (partnerState.active) {
    const engine = ENGINE_LABELS[partnerState.engine] || "";
    text = `${otherTab ? "別のタブで" : ""}キャプチャ中${engine ? `（${engine}）` : ""}: ${partnerState.message || ""}`;
  } else if (partnerState.kind === "error" || partnerState.message) {
    text = partnerState.message;
  } else {
    text = onMeet ? "未キャプチャ" : "Meet のタブで開始できます";
    kind = "off";
  }
  setStatus("partnerStatus", "partnerStatusText", kind, text);
}

// ---------------------------------------------------------------------------
// 保存・操作
// ---------------------------------------------------------------------------

async function save(patch) {
  await chrome.storage.sync.set(patch);
}

async function refreshKey() {
  const { geminiApiKey } = await chrome.storage.local.get({ geminiApiKey: "" });
  hasKey = Boolean(geminiApiKey && geminiApiKey.trim());
  $("apiKey").value = geminiApiKey || "";
  renderKeyStatus();
  renderMode(await chrome.storage.sync.get(DEFAULT_SETTINGS));
}

async function saveKey() {
  const value = $("apiKey").value.trim();
  if (!value) {
    renderKeyStatus("API キーを入力してください", "error");
    return;
  }
  await chrome.storage.local.set({ geminiApiKey: value });
  await refreshKey();
  renderKeyStatus("保存しました。接続テストで動作を確認できます", "listening");
}

async function clearKey() {
  await chrome.storage.local.remove("geminiApiKey");
  await refreshKey();
}

async function testKey() {
  if ($("apiKey").value.trim() && !hasKey) await saveKey();
  if (!hasKey) {
    renderKeyStatus("API キーを保存してからテストしてください", "error");
    return;
  }
  $("testKey").disabled = true;
  renderKeyStatus("テスト中…（セブアノ語の口語文を翻訳しています）", "starting");
  try {
    const res = await chrome.runtime.sendMessage({ type: "PVL_TEST_GEMINI" });
    if (!res || !res.ok) throw new Error((res && res.error) || "応答がありません");
    renderKeyStatus(`OK: ${res.text}`, "listening");
  } catch (err) {
    renderKeyStatus(`失敗: ${err && err.message ? err.message : err}`, "error");
  } finally {
    $("testKey").disabled = false;
  }
}

async function togglePartner() {
  const button = $("partnerToggle");
  button.disabled = true;
  try {
    if (partnerState.active) {
      const res = await chrome.runtime.sendMessage({ type: "PVL_PARTNER_STOP" });
      if (res && res.state) partnerState = res.state;
      return;
    }
    if (!isMeetTab(activeTab)) throw new Error("Google Meet のタブで開始してください");
    partnerState = { ...partnerState, kind: "starting", message: "起動中…" };
    renderPartner();
    // popup を開く操作がユーザー操作として扱われるため、ここで streamId を取得する
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id });
    const res = await chrome.runtime.sendMessage({ type: "PVL_PARTNER_START", tabId: activeTab.id, streamId });
    if (!res || !res.ok) throw new Error((res && res.error) || "開始できませんでした");
    partnerState = res.state;
  } catch (err) {
    partnerState = { ...partnerState, active: false, kind: "error", message: err && err.message ? err.message : String(err) };
  } finally {
    renderPartner();
  }
}

// ---------------------------------------------------------------------------
// 初期化
// ---------------------------------------------------------------------------

async function init() {
  fillSelect($("sourceLang"), languageItems());
  fillSelect($("targetLang"), languageItems());
  fillSelect($("provider"), PROVIDERS);
  fillSelect($("partnerEngine"), PARTNER_ENGINES);

  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (_) {
    activeTab = null;
  }
  // host_permissions に meet.google.com があるため、Meet タブなら url が取得できる
  $("noteMeet").hidden = isMeetTab(activeTab);

  await refreshKey();
  renderSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));

  try {
    const res = await chrome.runtime.sendMessage({ type: "PVL_GET_PARTNER_STATE" });
    if (res && res.ok && res.state) partnerState = res.state;
  } catch (_) {
    /* background 起動前 */
  }
  renderPartner();

  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("captureSelf").addEventListener("change", (e) => save({ captureSelf: e.target.checked }));
  $("sourceLang").addEventListener("change", (e) => save({ sourceLang: e.target.value }));
  $("targetLang").addEventListener("change", (e) => save({ targetLang: e.target.value }));
  $("provider").addEventListener("change", (e) => save({ provider: e.target.value }));
  $("partnerEngine").addEventListener("change", (e) => save({ partnerEngine: e.target.value }));
  $("showOriginal").addEventListener("change", (e) => save({ showOriginal: e.target.checked }));
  $("geminiModel").addEventListener("change", (e) =>
    save({ geminiModel: e.target.value.trim() || DEFAULT_SETTINGS.geminiModel }),
  );
  $("glossary").addEventListener("change", (e) => save({ glossary: e.target.value.slice(0, MAX_GLOSSARY_LENGTH) }));

  $("swap").addEventListener("click", async () => {
    const { sourceLang, targetLang } = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    save({ sourceLang: targetLang, targetLang: sourceLang });
  });

  $("partnerToggle").addEventListener("click", togglePartner);
  $("saveKey").addEventListener("click", saveKey);
  $("clearKey").addEventListener("click", clearKey);
  $("testKey").addEventListener("click", testKey);
  $("apiKey").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveKey();
  });
  $("toggleKey").addEventListener("click", () => {
    const input = $("apiKey");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("toggleKey").textContent = show ? "隠す" : "表示";
    $("toggleKey").setAttribute("aria-label", show ? "APIキーを隠す" : "APIキーを表示");
  });

  // 字幕側の × ボタンなど、ポップアップ外での変更も反映する
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area === "sync") renderSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "PVL_PARTNER_STATE" && message.state) {
      partnerState = message.state;
      renderPartner();
    }
    return false;
  });
}

init();
