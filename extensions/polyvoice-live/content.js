/*
 * PolyVoice Live - content script (Google Meet)
 *
 * 流れ:
 *   マイク音声 → Web Speech API (interimResults) → 途中経過をそのまま字幕表示
 *   → 文末確定 (isFinal) → background.js に翻訳依頼 → 翻訳文を字幕に反映
 *
 * DOM は createElement / textContent のみで組み立てる（Meet は Trusted Types を
 * 強制しているため innerHTML は使わない）。
 */
(() => {
  "use strict";

  if (window.__polyVoiceLiveInjected) return;
  window.__polyVoiceLiveInjected = true;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    sourceLang: "ja-JP",
    targetLang: "en-US",
    showOriginal: true,
    provider: "google",
  });

  // speech: Web Speech API に渡す言語コードの候補。先頭から試し、
  // "language-not-supported" が返ったら次の候補へフォールバックする。
  // Chrome はタガログ語を "fil-PH" として扱うため tl-PH より先に試す。
  // セブアノ語は Chrome の音声認識で未対応のことが多いため fil-PH → en-US へ落とす。
  const LANGUAGES = Object.freeze({
    "ja-JP": { label: "日本語", short: "JA", speech: ["ja-JP"] },
    "en-US": { label: "English", short: "EN", speech: ["en-US"] },
    "tl-PH": { label: "Tagalog", short: "TL", speech: ["fil-PH", "tl-PH"] },
    "ceb-PH": { label: "Cebuano", short: "CEB", speech: ["ceb-PH", "fil-PH", "en-US"] },
  });

  const MAX_LINES = 3;
  const LINE_TTL_MS = 30000;
  const MAX_RESTART_DELAY_MS = 8000;
  const MEETING_PATH = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:$|[/?#])/i;

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    recognition: null,
    running: false, // 認識を継続したい状態か（onend 後に自動再開するか）
    speechIndex: 0, // LANGUAGES[sourceLang].speech のどの候補を使っているか
    restartTimer: null,
    errorStreak: 0,
    fatal: null, // 自動復旧できないエラー（マイク拒否など）
    status: { kind: "idle", message: "" },
    lines: [], // { id, original, translated, status: "pending" | "done" | "error", createdAt }
    seq: 0,
    minimized: false,
  };

  const ui = {};

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function iconButton(label, title, onClick) {
    const btn = el("button", "pvl-btn", label);
    btn.type = "button";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function ensureOverlay() {
    if (ui.root && ui.root.isConnected) return;

    const root = el("div", "pvl-root pvl-hidden");
    root.id = "polyvoice-live-root";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "PolyVoice Live 字幕");

    const panel = el("div", "pvl-panel");

    const header = el("div", "pvl-header");
    const dot = el("span", "pvl-dot");
    const title = el("span", "pvl-title", "PolyVoice Live");
    const langs = el("span", "pvl-langs");
    const status = el("span", "pvl-status");
    const actions = el("div", "pvl-actions");
    const minimizeBtn = iconButton("–", "最小化", () => {
      state.minimized = !state.minimized;
      updateHeader();
    });
    const closeBtn = iconButton("×", "翻訳をOFFにする", () => {
      chrome.storage.sync.set({ enabled: false }).catch(() => {});
    });
    actions.append(minimizeBtn, closeBtn);
    header.append(dot, title, langs, status, actions);

    const body = el("div", "pvl-body");
    const list = el("div", "pvl-lines");
    list.setAttribute("aria-live", "polite");
    const interim = el("div", "pvl-interim pvl-empty");
    const placeholder = el("div", "pvl-placeholder", "話し始めると、ここに字幕が表示されます");
    body.append(placeholder, list, interim);

    panel.append(header, body);
    root.append(panel);
    document.body.appendChild(root);

    Object.assign(ui, { root, panel, dot, langs, status, minimizeBtn, list, interim, placeholder });
    updateHeader();
    renderLines();
  }

  function updateHeader() {
    if (!ui.root) return;
    const { sourceLang, targetLang } = state.settings;
    const src = LANGUAGES[sourceLang] || LANGUAGES["en-US"];
    const dst = LANGUAGES[targetLang] || LANGUAGES["en-US"];
    ui.langs.textContent = `${src.short} → ${dst.short}`;
    ui.langs.title = `${src.label} → ${dst.label}`;
    ui.dot.dataset.state = state.status.kind;
    ui.status.textContent = state.status.message;
    ui.status.title = state.status.message;
    ui.status.dataset.state = state.status.kind;
    ui.root.classList.toggle("pvl-minimized", state.minimized);
    ui.minimizeBtn.textContent = state.minimized ? "+" : "–";
    ui.minimizeBtn.title = state.minimized ? "展開" : "最小化";
  }

  function setStatus(kind, message = "") {
    state.status = { kind, message };
    updateHeader();
  }

  function setInterim(text) {
    if (!ui.interim) return;
    const value = text.trim();
    ui.interim.textContent = value;
    ui.interim.classList.toggle("pvl-empty", !value);
    updatePlaceholder();
  }

  function updatePlaceholder() {
    if (!ui.placeholder) return;
    const hasContent = state.lines.length > 0 || !ui.interim.classList.contains("pvl-empty");
    ui.placeholder.classList.toggle("pvl-hidden", hasContent);
  }

  function renderLines() {
    if (!ui.list) return;
    const nodes = state.lines.map((line) => {
      const row = el("div", "pvl-line");
      row.dataset.status = line.status;
      row.dataset.id = String(line.id);

      if (state.settings.showOriginal) {
        row.append(el("div", "pvl-original", line.original));
      }

      let translatedText = line.translated;
      if (line.status === "pending") translatedText = "翻訳中…";
      row.append(el("div", "pvl-translated", translatedText));
      return row;
    });
    ui.list.replaceChildren(...nodes);
    updatePlaceholder();
  }

  // ---------------------------------------------------------------------------
  // 翻訳
  // ---------------------------------------------------------------------------

  function isContextInvalidated(err) {
    return /context invalidated/i.test(String(err && err.message));
  }

  async function translateLine(line) {
    const { sourceLang, targetLang, provider } = state.settings;

    if (sourceLang === targetLang) {
      line.translated = line.original;
      line.status = "done";
      renderLines();
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: "PVL_TRANSLATE",
        text: line.original,
        source: sourceLang,
        target: targetLang,
        provider,
      });
      if (!res || !res.ok) throw new Error((res && res.error) || "翻訳に失敗しました");
      line.translated = res.text;
      line.status = "done";
    } catch (err) {
      line.status = "error";
      line.translated = isContextInvalidated(err)
        ? "拡張機能が更新されました。ページを再読み込みしてください"
        : `翻訳エラー: ${err && err.message ? err.message : err}`;
      if (isContextInvalidated(err)) setFatal("拡張機能が再読み込みされました。Meet のページを更新してください");
    }
    // 翻訳待ちの間に古い行として削除されていれば描画不要
    if (state.lines.includes(line)) renderLines();
  }

  function commitFinal(text) {
    const original = text.trim();
    if (!original) return;
    const line = {
      id: ++state.seq,
      original,
      translated: "",
      status: "pending",
      createdAt: Date.now(),
    };
    state.lines.push(line);
    if (state.lines.length > MAX_LINES) state.lines.splice(0, state.lines.length - MAX_LINES);
    renderLines();
    translateLine(line);
  }

  function pruneOldLines() {
    const cutoff = Date.now() - LINE_TTL_MS;
    const before = state.lines.length;
    state.lines = state.lines.filter((line) => line.status === "pending" || line.createdAt >= cutoff);
    if (state.lines.length !== before) renderLines();
  }

  // ---------------------------------------------------------------------------
  // 音声認識
  // ---------------------------------------------------------------------------

  function speechCandidates() {
    return (LANGUAGES[state.settings.sourceLang] || LANGUAGES["en-US"]).speech;
  }

  function currentSpeechLang() {
    const candidates = speechCandidates();
    return candidates[Math.min(state.speechIndex, candidates.length - 1)];
  }

  function listeningMessage() {
    const lang = currentSpeechLang();
    if (state.speechIndex > 0) {
      return `認識中 · ${speechCandidates()[0]} 非対応のため ${lang} で代替`;
    }
    return `認識中 · ${lang}`;
  }

  function detachRecognition() {
    const rec = state.recognition;
    if (!rec) return;
    state.recognition = null;
    rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
    try {
      rec.abort();
    } catch (_) {
      /* 既に停止済み */
    }
  }

  function startRecognition() {
    clearTimeout(state.restartTimer);
    state.restartTimer = null;
    detachRecognition();

    if (!SpeechRecognitionImpl) {
      setFatal("このブラウザは Web Speech API (SpeechRecognition) に対応していません");
      return;
    }

    const rec = new SpeechRecognitionImpl();
    rec.lang = currentSpeechLang();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (state.recognition !== rec) return;
      setStatus("listening", listeningMessage());
    };

    rec.onresult = (event) => {
      if (state.recognition !== rec) return;
      state.errorStreak = 0;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0] ? result[0].transcript : "";
        if (result.isFinal) commitFinal(transcript);
        else interim += transcript;
      }
      setInterim(interim);
    };

    rec.onerror = (event) => {
      if (state.recognition !== rec) return;
      handleRecognitionError(event.error);
    };

    rec.onend = () => {
      if (state.recognition !== rec) return;
      state.recognition = null;
      setInterim("");
      // Chrome は無音が続くと自動で認識を終了するため、ON の間は再開し続ける
      if (state.running && !state.fatal) scheduleRestart();
    };

    state.recognition = rec;
    setStatus("starting", `起動中… (${rec.lang})`);
    try {
      rec.start();
    } catch (err) {
      console.warn("[PolyVoice] recognition.start failed:", err);
      state.recognition = null;
      state.errorStreak++;
      scheduleRestart();
    }
  }

  function handleRecognitionError(error) {
    switch (error) {
      case "no-speech":
      case "aborted":
        // 無音・中断は正常系。onend で再開する
        return;
      case "not-allowed":
      case "service-not-allowed":
        setFatal("マイクの使用が許可されていません。Meet のマイク権限を確認してください");
        return;
      case "audio-capture":
        setFatal("マイクが見つかりません。入力デバイスを確認してください");
        return;
      case "language-not-supported": {
        const candidates = speechCandidates();
        if (state.speechIndex < candidates.length - 1) {
          state.speechIndex++;
          setStatus("starting", `${candidates[state.speechIndex - 1]} は非対応 → ${currentSpeechLang()} で再試行`);
          // onend が続けて呼ばれ、新しい言語で再開される
          return;
        }
        setFatal(`${candidates.join(" / ")} の音声認識に対応していません`);
        return;
      }
      case "network":
        state.errorStreak++;
        setStatus("error", "音声認識サーバーに接続できません。再接続中…");
        return;
      default:
        state.errorStreak++;
        setStatus("error", `音声認識エラー (${error})。再試行中…`);
    }
  }

  function scheduleRestart() {
    clearTimeout(state.restartTimer);
    const delay = state.errorStreak
      ? Math.min(500 * 2 ** (state.errorStreak - 1), MAX_RESTART_DELAY_MS)
      : 250;
    state.restartTimer = setTimeout(() => {
      state.restartTimer = null;
      if (state.running && !state.fatal) startRecognition();
    }, delay);
  }

  function stopRecognition() {
    state.running = false;
    clearTimeout(state.restartTimer);
    state.restartTimer = null;
    detachRecognition();
    setInterim("");
    if (!state.fatal) setStatus("idle", "停止中");
  }

  function setFatal(message) {
    state.fatal = message;
    stopRecognition();
    setStatus("error", message);
  }

  // ---------------------------------------------------------------------------
  // 設定と状態の同期
  // ---------------------------------------------------------------------------

  function isMeetingRoom() {
    return MEETING_PATH.test(location.pathname);
  }

  // 「ON かつ会議画面にいる」ときだけ認識と字幕を有効にする
  function reconcile() {
    ensureOverlay();
    const active = Boolean(state.settings.enabled) && isMeetingRoom();
    ui.root.classList.toggle("pvl-hidden", !active);

    if (active && !state.running && !state.fatal) {
      state.running = true;
      state.errorStreak = 0;
      startRecognition();
    } else if (!active && state.running) {
      stopRecognition();
    }
  }

  function applySettings(next) {
    const prev = state.settings;
    state.settings = { ...DEFAULT_SETTINGS, ...next };

    const sourceChanged = prev.sourceLang !== state.settings.sourceLang;
    const turnedOn = state.settings.enabled && !prev.enabled;

    if (sourceChanged) state.speechIndex = 0;
    // ON にし直す / 言語を変える ことで、致命的エラーから再試行できるようにする
    if (turnedOn || sourceChanged) state.fatal = null;

    if (sourceChanged && state.running) {
      state.errorStreak = 0;
      startRecognition();
    }

    reconcile();
    updateHeader();
    renderLines();
  }

  async function init() {
    ensureOverlay();

    let stored = DEFAULT_SETTINGS;
    try {
      stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    } catch (err) {
      console.warn("[PolyVoice] failed to load settings:", err);
    }
    // 初回は前回値との差分判定を効かせるため enabled:false から適用する
    state.settings = { ...DEFAULT_SETTINGS, enabled: false };
    applySettings(stored);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const next = { ...state.settings };
      let touched = false;
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (changes[key]) {
          next[key] = changes[key].newValue === undefined ? DEFAULT_SETTINGS[key] : changes[key].newValue;
          touched = true;
        }
      }
      if (touched) applySettings(next);
    });

    // Meet は SPA のため、待機画面 → 会議画面の遷移は URL の変化で検知する
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        reconcile();
      }
      if (ui.root && !ui.root.isConnected) {
        ensureOverlay();
        reconcile();
      }
      pruneOldLines();
    }, 1000);

    window.addEventListener("pagehide", () => stopRecognition());
  }

  init();
})();
