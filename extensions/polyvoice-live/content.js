/*
 * PolyVoice Live - content script（全 http/https ページに注入）
 *
 * 自分 (You) ※ Google Meet の会議画面のみ:
 *   マイク → Web Speech API (interimResults) → 途中経過を字幕表示
 *   → 文末確定 (isFinal) → background.js で「自分の言語 → 相手の言語」に翻訳
 *
 * 相手 (Partner) / 動画 (Video):
 *   ポップアップで「タブ音声キャプチャ」を開始したタブでは、offscreen document が
 *   タブ音声を認識し、background.js 経由で PVL_PARTNER_EVENT が届く
 *   → 「相手・動画の言語 → 自分の言語」に翻訳（Gemini 音声認識モードでは翻訳済みで届く）
 *   Meet 以外（YouTube など）では、この経路だけで字幕を表示する。
 *
 * 字幕 DOM は必要になるまで作らない（全ページに注入されるため）。
 * DOM は createElement / textContent のみで組み立てる（Meet / YouTube は Trusted Types を
 * 強制しているため innerHTML は使わない）。
 */
(() => {
  "use strict";

  if (window.__polyVoiceLiveInjected) return;
  window.__polyVoiceLiveInjected = true;

  const { LANGUAGES, DEFAULT_SETTINGS } = globalThis.PVL_SHARED;
  const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

  const MAX_LINES = 4;
  const LINE_TTL_MS = 30000;
  const MAX_RESTART_DELAY_MS = 8000;
  const MEET_HOST = "meet.google.com";
  const MEETING_PATH = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:$|[/?#])/i;
  const ENGINE_LABELS = Object.freeze({ browser: "Web Speech", gemini: "Gemini" });

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    // 自分のマイク認識
    recognition: null,
    running: false, // 認識を継続したい状態か（onend 後に自動再開するか）
    speechIndex: 0, // LANGUAGES[sourceLang].speech のどの候補を使っているか
    restartTimer: null,
    errorStreak: 0,
    fatal: null, // 自動復旧できないエラー（マイク拒否など）
    self: { kind: "off", message: "" },
    // 相手のタブ音声（background から通知）
    partner: { active: false, kind: "off", message: "", engine: null },
    interim: { self: "", partner: "" },
    lines: [], // { key, speaker, original, translated, status, createdAt }
    seq: 0,
    minimized: false,
  };

  const ui = {};

  function lang(id) {
    return LANGUAGES[id] || LANGUAGES["en-US"];
  }

  function isMeetPage() {
    return location.hostname === MEET_HOST;
  }

  function isMeetingRoom() {
    return isMeetPage() && MEETING_PATH.test(location.pathname);
  }

  // Meet では会話の相手、それ以外のサイトでは動画などのタブ音声
  function speakerLabel(speaker) {
    if (speaker === "self") return "You";
    return isMeetPage() ? "Partner" : "Video";
  }

  function partnerName() {
    return isMeetPage() ? "相手" : "動画";
  }

  // self: 自分の言語 → 相手の言語 / partner: 相手の言語 → 自分の言語
  function direction(speaker) {
    const { sourceLang, targetLang } = state.settings;
    return speaker === "partner" ? { from: targetLang, to: sourceLang } : { from: sourceLang, to: targetLang };
  }

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

  function speakerChip(speaker) {
    const chip = el("span", "pvl-chip");
    chip.dataset.speaker = speaker;
    const dot = el("span", "pvl-dot");
    const label = el("span", "pvl-chip-label");
    chip.append(dot, label);
    return { chip, dot, label };
  }

  function interimRow(speaker) {
    const row = el("div", "pvl-interim pvl-empty");
    row.dataset.speaker = speaker;
    const tag = el("span", "pvl-speaker", speakerLabel(speaker));
    const text = el("span", "pvl-interim-text");
    row.append(tag, text);
    return { row, tag, text };
  }

  // 全画面表示中は全画面要素の中に置かないと字幕が見えない（YouTube のプレーヤーなど）。
  // <video> 自体が全画面の場合は子要素を描画できないため body に置く。
  function overlayHost() {
    const fs = document.fullscreenElement;
    return fs && fs.tagName !== "VIDEO" ? fs : document.body;
  }

  function mountOverlay() {
    if (!ui.root) return;
    const host = overlayHost();
    if (host && ui.root.parentNode !== host) host.appendChild(ui.root);
  }

  function ensureOverlay() {
    if (ui.root && ui.root.isConnected) return;
    if (!document.body) return;

    const root = el("div", "pvl-root pvl-hidden");
    root.id = "polyvoice-live-root";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "PolyVoice Live 字幕");

    const panel = el("div", "pvl-panel");

    const header = el("div", "pvl-header");
    const title = el("span", "pvl-title", "PolyVoice Live");
    const self = speakerChip("self");
    const partner = speakerChip("partner");
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
    header.append(title, self.chip, partner.chip, status, actions);

    const body = el("div", "pvl-body");
    const list = el("div", "pvl-lines");
    list.setAttribute("aria-live", "polite");
    const interimSelf = interimRow("self");
    const interimPartner = interimRow("partner");
    const placeholder = el("div", "pvl-placeholder");
    body.append(placeholder, list, interimPartner.row, interimSelf.row);

    panel.append(header, body);
    root.append(panel);
    Object.assign(ui, {
      root,
      status,
      minimizeBtn,
      list,
      placeholder,
      chips: { self, partner },
      interims: { self: interimSelf, partner: interimPartner },
    });
    mountOverlay();
    updateHeader();
    renderInterims();
    renderLines();
  }

  // 自分のマイク認識は Meet の会議画面だけで動かす（動画サイトでは不要）
  function selfEnabled() {
    return Boolean(state.settings.enabled && state.settings.captureSelf) && isMeetingRoom();
  }

  function statusText() {
    const parts = [];
    if (selfEnabled() || state.fatal) {
      parts.push({ error: state.self.kind === "error", text: state.self.message ? `自分: ${state.self.message}` : "" });
    }
    if (state.partner.active || state.partner.kind === "error") {
      parts.push({
        error: state.partner.kind === "error",
        text: state.partner.message ? `${partnerName()}: ${state.partner.message}` : "",
      });
    }
    // エラーを先頭に出す
    parts.sort((a, b) => Number(b.error) - Number(a.error));
    return {
      text: parts.map((p) => p.text).filter(Boolean).join(" / "),
      error: parts.some((p) => p.error),
    };
  }

  function updateHeader() {
    if (!ui.root) return;

    for (const speaker of ["self", "partner"]) {
      const { from, to } = direction(speaker);
      const chip = ui.chips[speaker];
      let text = `${speakerLabel(speaker)} ${lang(from).short}→${lang(to).short}`;
      let kind;
      if (speaker === "self") {
        kind = selfEnabled() ? state.self.kind : "off";
        chip.chip.title = selfEnabled() ? `自分の音声: ${state.self.message}` : "自分の音声認識: OFF";
      } else {
        kind = state.partner.active ? state.partner.kind : state.partner.kind === "error" ? "error" : "off";
        if (state.partner.active && state.partner.engine) text += ` · ${ENGINE_LABELS[state.partner.engine] || ""}`;
        chip.chip.title = state.partner.active
          ? `${partnerName()}の音声: ${state.partner.message}`
          : `${partnerName()}の音声: 未キャプチャ（ポップアップから開始）`;
      }
      chip.label.textContent = text;
      chip.dot.dataset.state = kind;
      chip.chip.dataset.state = kind;
      ui.interims[speaker].tag.textContent = speakerLabel(speaker);
    }
    // Meet 以外ではマイク認識を使わないため「You」チップを出さない
    ui.chips.self.chip.classList.toggle("pvl-hidden", !isMeetPage());
    ui.placeholder.textContent = isMeetPage()
      ? "話し始めると、ここに字幕が表示されます"
      : "タブの音声が流れると、ここに翻訳字幕が表示されます";

    const status = statusText();
    ui.status.textContent = status.text;
    ui.status.title = status.text;
    ui.status.dataset.state = status.error ? "error" : "ok";
    ui.root.classList.toggle("pvl-minimized", state.minimized);
    ui.minimizeBtn.textContent = state.minimized ? "+" : "–";
    ui.minimizeBtn.title = state.minimized ? "展開" : "最小化";
  }

  function setSelfStatus(kind, message = "") {
    state.self = { kind, message };
    updateHeader();
  }

  function setInterim(speaker, text) {
    state.interim[speaker] = (text || "").trim();
    renderInterims();
  }

  function renderInterims() {
    if (!ui.interims) return;
    for (const speaker of ["self", "partner"]) {
      const { row, text } = ui.interims[speaker];
      const value = state.interim[speaker];
      text.textContent = value;
      row.classList.toggle("pvl-empty", !value);
    }
    updatePlaceholder();
  }

  function updatePlaceholder() {
    if (!ui.placeholder) return;
    const hasContent = state.lines.length > 0 || Boolean(state.interim.self || state.interim.partner);
    ui.placeholder.classList.toggle("pvl-hidden", hasContent);
  }

  function lineText(line) {
    switch (line.status) {
      case "transcribing":
        return "音声を解析中…";
      case "pending":
        return "翻訳中…";
      default:
        return line.translated;
    }
  }

  function renderLines() {
    if (!ui.list) return;
    const nodes = state.lines.map((line) => {
      const row = el("div", "pvl-line");
      row.dataset.status = line.status;
      row.dataset.speaker = line.speaker;

      const tag = el("span", "pvl-speaker", speakerLabel(line.speaker));
      const content = el("div", "pvl-line-content");
      if (state.settings.showOriginal && line.original) {
        content.append(el("div", "pvl-original", line.original));
      }
      content.append(el("div", "pvl-translated", lineText(line)));
      row.append(tag, content);
      return row;
    });
    ui.list.replaceChildren(...nodes);
    updatePlaceholder();
  }

  // ---------------------------------------------------------------------------
  // 字幕行と翻訳
  // ---------------------------------------------------------------------------

  function addLine(fields) {
    const line = {
      key: `self:${++state.seq}`,
      speaker: "self",
      original: "",
      translated: "",
      status: "pending",
      createdAt: Date.now(),
      ...fields,
    };
    state.lines.push(line);
    if (state.lines.length > MAX_LINES) state.lines.splice(0, state.lines.length - MAX_LINES);
    renderLines();
    return line;
  }

  function findLine(key) {
    return state.lines.find((line) => line.key === key) || null;
  }

  function removeLine(line) {
    state.lines = state.lines.filter((l) => l !== line);
    renderLines();
  }

  function isContextInvalidated(err) {
    return /context invalidated/i.test(String(err && err.message));
  }

  async function translateLine(line) {
    const { from, to } = direction(line.speaker);

    if (from === to) {
      line.translated = line.original;
      line.status = "done";
      renderLines();
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: "PVL_TRANSLATE",
        text: line.original,
        source: from,
        target: to,
        speaker: line.speaker,
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
    line.createdAt = Date.now();
    // 翻訳待ちの間に古い行として削除されていれば描画不要
    if (state.lines.includes(line)) renderLines();
  }

  function commitSelfFinal(text) {
    const original = text.trim();
    if (!original) return;
    translateLine(addLine({ speaker: "self", original }));
  }

  function pruneOldLines() {
    const cutoff = Date.now() - LINE_TTL_MS;
    const before = state.lines.length;
    state.lines = state.lines.filter(
      (line) => line.status === "pending" || line.status === "transcribing" || line.createdAt >= cutoff,
    );
    if (state.lines.length !== before) renderLines();
  }

  // ---------------------------------------------------------------------------
  // 相手の音声イベント（background.js から）
  // ---------------------------------------------------------------------------

  function applyPartnerState(partner) {
    state.partner = {
      active: Boolean(partner.active),
      kind: partner.kind || (partner.active ? "starting" : "off"),
      message: partner.message || "",
      engine: partner.engine || null,
    };
    if (!state.partner.active) setInterim("partner", "");
    // Meet 以外のサイトでは、タブ音声キャプチャの開始・終了で字幕の表示/非表示が変わる
    reconcile();
  }

  function handlePartnerEvent(message) {
    switch (message.event) {
      case "status":
        applyPartnerState(message);
        return;

      case "interim":
        setInterim("partner", message.text);
        return;

      case "activity":
        // Gemini モードは途中結果がないため、発話中であることだけ示す
        setInterim("partner", message.speaking ? "話しています…" : "");
        return;

      case "pending":
        addLine({ key: `partner:${message.id}`, speaker: "partner", status: "transcribing" });
        return;

      case "final": {
        setInterim("partner", "");
        const key = `partner:${message.id}`;
        const text = (message.text || "").trim();
        let line = findLine(key);
        if (!text) {
          // 無音・雑音だった区間
          if (line) removeLine(line);
          return;
        }
        if (!line) line = addLine({ key, speaker: "partner", original: text });
        line.original = text;
        line.createdAt = Date.now();
        if (typeof message.translated === "string" && message.translated) {
          line.translated = message.translated;
          line.status = "done";
          renderLines();
        } else {
          line.status = "pending";
          renderLines();
          translateLine(line);
        }
        return;
      }

      case "error": {
        const line = findLine(`partner:${message.id}`);
        if (line) {
          line.status = "error";
          line.translated = `音声解析エラー: ${message.message || "不明なエラー"}`;
          line.createdAt = Date.now();
          renderLines();
        }
        return;
      }

      default:
    }
  }

  // ---------------------------------------------------------------------------
  // 自分の音声認識
  // ---------------------------------------------------------------------------

  function speechCandidates() {
    return lang(state.settings.sourceLang).speech;
  }

  function currentSpeechLang() {
    const candidates = speechCandidates();
    return candidates[Math.min(state.speechIndex, candidates.length - 1)];
  }

  function listeningMessage() {
    const speechLang = currentSpeechLang();
    if (state.speechIndex > 0) {
      return `認識中 · ${speechCandidates()[0]} 非対応のため ${speechLang} で代替`;
    }
    return `認識中 · ${speechLang}`;
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
      setSelfStatus("listening", listeningMessage());
    };

    rec.onresult = (event) => {
      if (state.recognition !== rec) return;
      state.errorStreak = 0;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0] ? result[0].transcript : "";
        if (result.isFinal) commitSelfFinal(transcript);
        else interim += transcript;
      }
      setInterim("self", interim);
    };

    rec.onerror = (event) => {
      if (state.recognition !== rec) return;
      handleRecognitionError(event.error);
    };

    rec.onend = () => {
      if (state.recognition !== rec) return;
      state.recognition = null;
      setInterim("self", "");
      // Chrome は無音が続くと自動で認識を終了するため、ON の間は再開し続ける
      if (state.running && !state.fatal) scheduleRestart();
    };

    state.recognition = rec;
    setSelfStatus("starting", `起動中… (${rec.lang})`);
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
          setSelfStatus("starting", `${candidates[state.speechIndex - 1]} は非対応 → ${currentSpeechLang()} で再試行`);
          // onend が続けて呼ばれ、新しい言語で再開される
          return;
        }
        setFatal(`${candidates.join(" / ")} の音声認識に対応していません`);
        return;
      }
      case "network":
        state.errorStreak++;
        setSelfStatus("error", "音声認識サーバーに接続できません。再接続中…");
        return;
      default:
        state.errorStreak++;
        setSelfStatus("error", `音声認識エラー (${error})。再試行中…`);
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
    setInterim("self", "");
    if (!state.fatal) setSelfStatus("off", "停止中");
  }

  function setFatal(message) {
    state.fatal = message;
    stopRecognition();
    setSelfStatus("error", message);
  }

  // ---------------------------------------------------------------------------
  // 設定と状態の同期
  // ---------------------------------------------------------------------------

  // 字幕を表示する条件: 翻訳 ON かつ
  //   - Meet の会議画面にいる、または
  //   - このタブでタブ音声キャプチャが動いている（YouTube など任意のサイト。失敗時はエラー表示のため残す）
  // 自分のマイク認識は Meet の会議画面かつ captureSelf が ON のときだけ。
  function overlayWanted() {
    if (!state.settings.enabled) return false;
    if (isMeetingRoom() || state.partner.active) return true;
    return !isMeetPage() && state.partner.kind === "error";
  }

  function reconcile() {
    const overlayActive = overlayWanted();
    const selfActive = overlayActive && selfEnabled();

    // 全ページに注入されるため、字幕 DOM は初めて必要になったときに作る
    if (overlayActive) ensureOverlay();
    if (ui.root) ui.root.classList.toggle("pvl-hidden", !overlayActive);

    if (selfActive && !state.running && !state.fatal) {
      state.running = true;
      state.errorStreak = 0;
      startRecognition();
    } else if (!selfActive && state.running) {
      stopRecognition();
    }
    updateHeader();
  }

  function applySettings(next) {
    const prev = state.settings;
    state.settings = { ...DEFAULT_SETTINGS, ...next };

    const sourceChanged = prev.sourceLang !== state.settings.sourceLang;
    const turnedOn =
      (state.settings.enabled && !prev.enabled) || (state.settings.captureSelf && !prev.captureSelf);

    if (sourceChanged) state.speechIndex = 0;
    // ON にし直す / 言語を変える ことで、致命的エラーから再試行できるようにする
    if (turnedOn || sourceChanged) state.fatal = null;

    if (sourceChanged && state.running) {
      state.errorStreak = 0;
      startRecognition();
    }

    reconcile();
    renderLines();
  }

  async function init() {
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
      for (const key of SETTING_KEYS) {
        if (changes[key]) {
          next[key] = changes[key].newValue === undefined ? DEFAULT_SETTINGS[key] : changes[key].newValue;
          touched = true;
        }
      }
      if (touched) applySettings(next);
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "PVL_PARTNER_EVENT") handlePartnerEvent(message);
      return false;
    });

    // ページ再読み込み後も、このタブで相手の音声キャプチャが続いていれば表示に反映する
    chrome.runtime
      .sendMessage({ type: "PVL_GET_PARTNER_STATE" })
      .then((res) => {
        if (res && res.ok && res.state) applyPartnerState(res.state);
      })
      .catch(() => {});

    // 全画面の切り替えに合わせて字幕を全画面要素の中へ移動する
    document.addEventListener("fullscreenchange", mountOverlay);

    // Meet / YouTube は SPA のため、画面遷移は URL の変化で検知する
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
