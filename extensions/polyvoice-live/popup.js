/*
 * PolyVoice Live - popup
 * Manifest V3 の CSP ではインラインスクリプトが禁止されているため、popup.html から分離している。
 * 設定は chrome.storage.sync に保存し、content.js は storage.onChanged で即時反映する。
 */

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  sourceLang: "ja-JP",
  targetLang: "en-US",
  showOriginal: true,
  provider: "google",
});

const LANGUAGES = [
  { id: "ja-JP", label: "日本語 (ja-JP)" },
  { id: "en-US", label: "English (en-US)" },
  { id: "tl-PH", label: "Tagalog (tl-PH)" },
  { id: "ceb-PH", label: "Cebuano (ceb-PH)" },
];

// background.js の TRANSLATION_PROVIDERS とキーを揃える
const PROVIDERS = [
  { id: "google", label: "Google Translate（非公式・無料）" },
  { id: "mymemory", label: "MyMemory（無料API）" },
  { id: "mock", label: "Mock（オフライン確認用）" },
];

const $ = (id) => document.getElementById(id);

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

function render(settings) {
  $("enabled").checked = Boolean(settings.enabled);
  $("sourceLang").value = settings.sourceLang;
  $("targetLang").value = settings.targetLang;
  $("provider").value = settings.provider;
  $("showOriginal").checked = Boolean(settings.showOriginal);

  $("noteCebuano").hidden = settings.sourceLang !== "ceb-PH";
  $("noteSame").hidden = settings.sourceLang !== settings.targetLang;
}

async function save(patch) {
  await chrome.storage.sync.set(patch);
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  render(settings);
}

async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // host_permissions に meet.google.com があるため、Meet タブなら url が取得できる
    const onMeet = Boolean(tab && tab.url && tab.url.startsWith("https://meet.google.com/"));
    $("noteMeet").hidden = onMeet;
  } catch (_) {
    $("noteMeet").hidden = false;
  }
}

async function init() {
  fillSelect($("sourceLang"), LANGUAGES);
  fillSelect($("targetLang"), LANGUAGES);
  fillSelect($("provider"), PROVIDERS);

  render(await chrome.storage.sync.get(DEFAULT_SETTINGS));
  checkActiveTab();

  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("sourceLang").addEventListener("change", (e) => save({ sourceLang: e.target.value }));
  $("targetLang").addEventListener("change", (e) => save({ targetLang: e.target.value }));
  $("provider").addEventListener("change", (e) => save({ provider: e.target.value }));
  $("showOriginal").addEventListener("change", (e) => save({ showOriginal: e.target.checked }));

  $("swap").addEventListener("click", async () => {
    const { sourceLang, targetLang } = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    save({ sourceLang: targetLang, targetLang: sourceLang });
  });

  // 字幕側の × ボタンなど、ポップアップ外での変更も反映する
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== "sync") return;
    render(await chrome.storage.sync.get(DEFAULT_SETTINGS));
  });
}

init();
