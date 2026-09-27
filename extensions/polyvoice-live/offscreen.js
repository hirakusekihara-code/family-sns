/*
 * PolyVoice Live - offscreen document（相手の音声 = Meet タブ音声の処理）
 *
 * background.js から tabCapture の streamId を受け取り、タブ音声の MediaStream を取得する。
 * tabCapture 中はタブの音がミュートされるため、AudioContext で再生し直して聞こえるようにする。
 *
 * 認識エンジン:
 *   browser: SpeechRecognition.start(audioTrack) でタブ音声を Web Speech API に直接渡す
 *            （途中結果あり。対応していない Chrome では gemini へ自動フォールバック）
 *   gemini : 音量ベースの簡易 VAD で発話区間を切り出し、16kHz WAV にして background へ送る
 *            （background が Gemini で文字起こし + 翻訳。セブアノ語はこちらが高精度）
 *
 * offscreen document からは chrome.runtime しか使えないため、イベントは
 * PVL_OFFSCREEN_EVENT / PVL_AUDIO_SEGMENT として background 経由で Meet タブへ届く。
 */

"use strict";

const SpeechRecognitionImpl = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const MAX_RESTART_DELAY_MS = 8000;
const NETWORK_FALLBACK_AFTER = 3;
const OUTPUT_SAMPLE_RATE = 16000;
const VAD = Object.freeze({
  threshold: 0.01, // RMS。これを超えるフレームを発話とみなす
  silenceMs: 700, // この長さの無音で区間を確定
  minSpeechMs: 400, // これより短い発話は捨てる（咳・物音対策）
  maxSegmentMs: 12000, // 長い発話は途中で区切って送る
  preRollMs: 300, // 発話開始直前の音も含める
});

const session = {
  stream: null,
  audioCtx: null,
  source: null,
  config: null, // { engine, speechLangs, fallbackToGemini }
  running: false,
  // browser engine
  recognition: null,
  speechIndex: 0,
  restartTimer: null,
  errorStreak: 0,
  // gemini engine
  processor: null,
  sink: null,
  segmenter: null,
  seq: 0,
};

function emit(event, data = {}) {
  chrome.runtime.sendMessage({ type: "PVL_OFFSCREEN_EVENT", event, ...data }).catch(() => {});
}

function emitStatus(kind, message) {
  emit("status", { kind, message, engine: session.config ? session.config.engine : null });
}

function nextId() {
  session.seq += 1;
  return `p${Date.now().toString(36)}-${session.seq}`;
}

// ---------------------------------------------------------------------------
// 開始・停止
// ---------------------------------------------------------------------------

async function start({ streamId, ...config }) {
  stop();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: false,
  });
  startWithStream(stream, config);
}

function startWithStream(stream, config) {
  const track = stream.getAudioTracks()[0];
  if (!track) throw new Error("タブ音声のトラックがありません");

  session.stream = stream;
  session.audioCtx = new AudioContext();
  session.source = session.audioCtx.createMediaStreamSource(stream);
  // キャプチャ中もユーザーが相手の声を聞けるように再生する
  session.source.connect(session.audioCtx.destination);
  session.config = { ...config };
  session.running = true;

  track.addEventListener("ended", () => {
    if (!session.running) return;
    emitStatus("ended", "タブ音声のキャプチャが終了しました");
    stop();
  });

  startEngine();
}

function stop() {
  session.running = false;
  stopEngines();
  if (session.stream) session.stream.getTracks().forEach((t) => t.stop());
  if (session.audioCtx) session.audioCtx.close().catch(() => {});
  session.stream = null;
  session.audioCtx = null;
  session.source = null;
}

function reconfigure(config) {
  if (!session.running) return;
  session.config = { ...session.config, ...config };
  session.speechIndex = 0;
  session.errorStreak = 0;
  startEngine();
}

function startEngine() {
  stopEngines();
  if (!session.running) return;
  if (session.config.engine === "gemini") startGeminiEngine();
  else startBrowserEngine();
}

function stopEngines() {
  stopBrowserEngine();
  stopGeminiEngine();
  emit("interim", { text: "" });
}

// 使えないエンジンからの切り替え（キーがあれば Gemini へ）
function fallbackOrFail(reason) {
  stopEngines();
  if (session.config.engine !== "gemini" && session.config.fallbackToGemini) {
    session.config.engine = "gemini";
    emitStatus("starting", `${reason} → Gemini 音声認識に切り替えます`);
    startGeminiEngine();
    return;
  }
  emitStatus("error", `${reason}。Gemini API キーを設定すると相手の音声を認識できます`);
}

// ---------------------------------------------------------------------------
// browser engine: Web Speech API にタブ音声トラックを渡す
// ---------------------------------------------------------------------------

function currentSpeechLang() {
  const langs = session.config.speechLangs || ["en-US"];
  return langs[Math.min(session.speechIndex, langs.length - 1)];
}

function startBrowserEngine() {
  if (!SpeechRecognitionImpl) {
    fallbackOrFail("このブラウザは Web Speech API に対応していません");
    return;
  }
  const track = session.stream && session.stream.getAudioTracks()[0];
  if (!track) return;

  const rec = new SpeechRecognitionImpl();
  rec.lang = currentSpeechLang();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    if (session.recognition !== rec) return;
    const langs = session.config.speechLangs;
    const note = session.speechIndex > 0 ? `（${langs[0]} 非対応のため代替）` : "";
    emitStatus("listening", `認識中 · ${rec.lang}${note}`);
  };

  rec.onresult = (event) => {
    if (session.recognition !== rec) return;
    session.errorStreak = 0;
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0] ? result[0].transcript : "";
      if (result.isFinal) {
        if (transcript.trim()) emit("final", { id: nextId(), text: transcript.trim() });
      } else {
        interim += transcript;
      }
    }
    emit("interim", { text: interim });
  };

  rec.onerror = (event) => {
    if (session.recognition !== rec) return;
    switch (event.error) {
      case "no-speech":
      case "aborted":
        return;
      case "not-allowed":
      case "service-not-allowed":
      case "audio-capture":
        // 音声トラック入力に未対応の Chrome では track が無視され、マイク権限のない
        // 拡張機能ページからの認識として拒否される
        stopBrowserEngine();
        fallbackOrFail("この Chrome はタブ音声の Web Speech 認識に対応していません");
        return;
      case "language-not-supported": {
        const langs = session.config.speechLangs;
        if (session.speechIndex < langs.length - 1) {
          session.speechIndex += 1;
          emitStatus("starting", `${langs[session.speechIndex - 1]} は非対応 → ${currentSpeechLang()} で再試行`);
          return; // onend で新しい言語で再開
        }
        stopBrowserEngine();
        fallbackOrFail(`${langs.join(" / ")} の音声認識に対応していません`);
        return;
      }
      case "network":
        session.errorStreak += 1;
        // 繰り返し失敗する場合、キーがあれば Gemini に切り替える（なければ再接続を続ける）
        if (session.errorStreak >= NETWORK_FALLBACK_AFTER && session.config.fallbackToGemini) {
          stopBrowserEngine();
          fallbackOrFail("Web Speech の認識サーバーに接続できません");
          return;
        }
        emitStatus("error", "音声認識サーバーに接続できません。再接続中…");
        return;
      default:
        session.errorStreak += 1;
        emitStatus("error", `音声認識エラー (${event.error})。再試行中…`);
    }
  };

  rec.onend = () => {
    if (session.recognition !== rec) return;
    session.recognition = null;
    emit("interim", { text: "" });
    if (session.running && session.config.engine === "browser") scheduleBrowserRestart();
  };

  session.recognition = rec;
  emitStatus("starting", `起動中… (${rec.lang})`);
  try {
    rec.start(track);
  } catch (err) {
    session.recognition = null;
    console.warn("[PolyVoice] recognition.start(track) failed:", err);
    fallbackOrFail("この Chrome はタブ音声の Web Speech 認識に対応していません");
  }
}

function scheduleBrowserRestart() {
  clearTimeout(session.restartTimer);
  const delay = session.errorStreak
    ? Math.min(500 * 2 ** (session.errorStreak - 1), MAX_RESTART_DELAY_MS)
    : 250;
  session.restartTimer = setTimeout(() => {
    session.restartTimer = null;
    if (session.running && session.config.engine === "browser") startBrowserEngine();
  }, delay);
}

function stopBrowserEngine() {
  clearTimeout(session.restartTimer);
  session.restartTimer = null;
  const rec = session.recognition;
  if (!rec) return;
  session.recognition = null;
  rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
  try {
    rec.abort();
  } catch (_) {
    /* 停止済み */
  }
}

// ---------------------------------------------------------------------------
// gemini engine: 発話区間を切り出して WAV で送る
// ---------------------------------------------------------------------------

function startGeminiEngine() {
  const ctx = session.audioCtx;
  if (!ctx || !session.source) return;

  session.segmenter = createSegmenter(ctx.sampleRate, {
    onSpeechStart: () => emit("activity", { speaking: true }),
    onSegment: (samples, sampleRate) => sendSegment(samples, sampleRate),
    onSpeechEnd: () => emit("activity", { speaking: false }),
  });

  // ScriptProcessorNode は非推奨だが追加ファイル不要で offscreen でも安定して動く
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0; // onaudioprocess を動かすためだけに destination へつなぐ
  processor.onaudioprocess = (event) => {
    if (session.segmenter) session.segmenter.push(event.inputBuffer.getChannelData(0));
  };
  session.source.connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);
  session.processor = processor;
  session.sink = sink;

  emitStatus("listening", "認識中 · Gemini 音声認識");
}

function stopGeminiEngine() {
  if (session.segmenter) {
    session.segmenter.flush();
    session.segmenter = null;
  }
  if (session.processor) {
    session.processor.onaudioprocess = null;
    try {
      session.source && session.source.disconnect(session.processor);
    } catch (_) {
      /* 接続済みでない */
    }
    session.processor.disconnect();
    session.processor = null;
  }
  if (session.sink) {
    session.sink.disconnect();
    session.sink = null;
  }
}

function createSegmenter(sampleRate, { onSpeechStart, onSegment, onSpeechEnd }) {
  let speaking = false;
  let chunks = [];
  let preRoll = [];
  let preRollMs = 0;
  let totalMs = 0;
  let speechMs = 0;
  let silenceMs = 0;

  function reset() {
    speaking = false;
    chunks = [];
    totalMs = 0;
    speechMs = 0;
    silenceMs = 0;
  }

  function flush() {
    if (!speaking) return;
    const enough = speechMs >= VAD.minSpeechMs;
    const segment = chunks;
    reset();
    onSpeechEnd();
    if (enough) onSegment(concat(segment), sampleRate);
  }

  function push(frame) {
    const copy = new Float32Array(frame);
    const durationMs = (copy.length / sampleRate) * 1000;
    const loud = rms(copy) >= VAD.threshold;

    if (!speaking) {
      preRoll.push(copy);
      preRollMs += durationMs;
      while (preRoll.length > 1 && preRollMs - (preRoll[0].length / sampleRate) * 1000 >= VAD.preRollMs) {
        preRollMs -= (preRoll.shift().length / sampleRate) * 1000;
      }
      if (!loud) return;
      speaking = true;
      chunks = preRoll;
      totalMs = preRollMs;
      speechMs = durationMs;
      silenceMs = 0;
      preRoll = [];
      preRollMs = 0;
      onSpeechStart();
      return;
    }

    chunks.push(copy);
    totalMs += durationMs;
    if (loud) {
      speechMs += durationMs;
      silenceMs = 0;
    } else {
      silenceMs += durationMs;
    }
    if (silenceMs >= VAD.silenceMs || totalMs >= VAD.maxSegmentMs) flush();
  }

  return { push, flush };
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (samples.length || 1));
}

function concat(chunks) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function downsample(samples, fromRate, toRate) {
  if (toRate >= fromRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function sendSegment(samples, sampleRate) {
  const id = nextId();
  const pcm = downsample(samples, sampleRate, OUTPUT_SAMPLE_RATE);
  const wav = encodeWav(pcm, Math.min(sampleRate, OUTPUT_SAMPLE_RATE));
  emit("pending", { id });
  chrome.runtime
    .sendMessage({ type: "PVL_AUDIO_SEGMENT", id, mimeType: "audio/wav", audioBase64: toBase64(wav) })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// background からのメッセージ
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== "offscreen") return false;

  switch (message.type) {
    case "PVL_OFFSCREEN_START":
      start(message)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => {
          stop();
          sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
        });
      return true;
    case "PVL_OFFSCREEN_STOP":
      stop();
      sendResponse({ ok: true });
      return false;
    case "PVL_OFFSCREEN_CONFIG":
      reconfigure(message);
      sendResponse({ ok: true });
      return false;
    default:
      return false;
  }
});
