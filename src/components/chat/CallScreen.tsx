"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { currentUserId, getMember } from "@/lib/mockData";
import { formatDuration, type CallType } from "@/lib/chatData";
import { useI18n } from "@/lib/i18n/useI18n";
import Avatar from "@/components/timeline/Avatar";

type Props = {
  callType: CallType;
  title: string;
  memberIds: string[]; // 自分以外の参加者
  onEnd: (connectedSec: number | null) => void; // null = つながる前に終了
};

const ANSWER_DELAY_MS = 2500; // 相手が応答するまでの擬似的な待ち時間

// 通話画面（プロトタイプ：相手側は擬似表示、自分のカメラ映像は本物）
export default function CallScreen({ callType, title, memberIds, onEnd }: Props) {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(callType === "video");
  const [cameraState, setCameraState] = useState<"pending" | "ready" | "unavailable">("pending");
  const streamRef = useRef<MediaStream | null>(null);

  const members = memberIds.map(getMember);
  const me = getMember(currentUserId);
  const isVideo = callType === "video";

  // 呼び出し → 数秒後に応答
  useEffect(() => {
    const t = setTimeout(() => setConnected(true), ANSWER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // 通話時間のカウント
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  // ビデオ通話のときは自分のカメラを起動
  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;
    const request =
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false }) ??
      Promise.reject(new Error("camera not supported"));
    request
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraState("ready");
      })
      .catch(() => {
        if (!cancelled) setCameraState("unavailable");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isVideo]);

  function toggleCamera() {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraOn(next);
  }

  const status = connected ? formatDuration(seconds) : t("call.calling");
  const showSelfVideo = isVideo && cameraOn && cameraState === "ready";

  // <video> が表示されるたびにカメラ映像をつなぐ
  // （呼び出し中は右上の小窓、グループ通話がつながるとタイルへ移動して要素が作り直されるため）
  function attachStream(video: HTMLVideoElement | null) {
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
  }

  // 自分の映像タイル
  const selfTile = (
    <div className="relative h-full w-full overflow-hidden bg-slate-700">
      <video
        ref={attachStream}
        autoPlay
        playsInline
        muted
        className={`h-full w-full -scale-x-100 object-cover ${showSelfVideo ? "" : "hidden"}`}
      />
      {!showSelfVideo && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
          <Avatar member={me} size="md" />
          <span className="px-1 text-[10px] text-white/70">
            {!cameraOn ? t("call.cameraOff") : cameraState === "unavailable" ? t("call.cameraUnavailable") : t("call.starting")}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col bg-gradient-to-b from-slate-800 via-indigo-950 to-slate-900 text-white">
      {/* 通話の相手表示 */}
      <div className="relative flex-1 overflow-hidden">
        {isVideo && connected && members.length > 1 ? (
          // グループのビデオ通話：タイル表示
          <div className="grid h-full grid-cols-2 gap-1 p-1 pt-24">
            {members.map((m) => (
              <div key={m.id} className="relative flex items-center justify-center rounded-2xl bg-slate-700/80">
                <Avatar member={m} size="lg" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-xs">{m.name}</span>
              </div>
            ))}
            <div className="relative overflow-hidden rounded-2xl">
              {selfTile}
              <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-xs">{t("common.you")}</span>
            </div>
          </div>
        ) : (
          // 1対1、または呼び出し中・音声通話
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex -space-x-6">
              {members.map((m) => (
                <span key={m.id} className="relative rounded-full ring-4 ring-slate-900">
                  {!connected && <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />}
                  <Avatar member={m} size={members.length > 1 ? "lg" : "xl"} />
                </span>
              ))}
            </div>
            {isVideo && connected && <p className="px-6 text-center text-xs text-white/50">{t("call.remoteNote")}</p>}
          </div>
        )}

        {/* 上部：名前と状態 */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/40 to-transparent px-4 pb-6 pt-8 text-center">
          <p className="text-xl font-semibold">{title}</p>
          <p className="mt-1 text-sm text-white/70">
            {t(isVideo ? "chat.videoCall" : "chat.voiceCall")} · {status}
          </p>
        </div>

        {/* 1対1ビデオ通話：自分の映像を右上に小さく表示 */}
        {isVideo && !(connected && members.length > 1) && (
          <div className="absolute right-4 top-28 h-40 w-28 overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/20">
            {selfTile}
          </div>
        )}
      </div>

      {/* 操作ボタン */}
      <div className="flex items-center justify-around rounded-t-3xl bg-black/40 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
        <CallButton label={t(muted ? "call.unmute" : "call.mute")} active={muted} onClick={() => setMuted((v) => !v)}>
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </CallButton>
        {isVideo ? (
          <CallButton label={t(cameraOn ? "call.cameraOff" : "call.cameraOn")} active={!cameraOn} onClick={toggleCamera}>
            {cameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </CallButton>
        ) : (
          <CallButton label={t("call.speaker")} active={!speakerOn} onClick={() => setSpeakerOn((v) => !v)}>
            {speakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </CallButton>
        )}
        <button
          type="button"
          onClick={() => onEnd(connected ? seconds : null)}
          aria-label={t("call.end")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 transition active:scale-95"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function CallButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
        active ? "bg-white text-slate-900" : "bg-white/15 text-white"
      }`}
    >
      {children}
    </button>
  );
}
