"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Member } from "@/lib/family";

// 地図の見た目：OpenStreetMap 公式の無料の地図（登録やキーは不要。出典の表示が条件）
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapPlace = { id: string; name: string; emoji: string; lat: number; lng: number; count: number };
export type MapMember = { member: Member; lat: number; lng: number; source: "gps" | "plan" };
export type LatLng = { lat: number; lng: number };
export type FocusRequest = { lat: number; lng: number; markerId?: string; seq: number };

type Props = {
  places: MapPlace[];
  members: MapMember[];
  youId: string;
  youLabel: string; // 「あなた」「You」
  pickMode: boolean; // 場所を登録するために地図をタップしてもらう状態
  draft: LatLng | null; // 登録しようとしている場所
  onPick: (pos: LatLng) => void;
  focus: FocusRequest | null;
  fallbackCenter: LatLng;
  renderPlacePopup: (placeId: string) => React.ReactNode;
  renderMemberPopup: (memberId: string) => React.ReactNode;
};

// 名前などを地図のアイコン（HTML）に入れる前に、安全な文字に置き換える
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function placeIcon(p: MapPlace) {
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    html: `<div class="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-md ring-1 ring-slate-200">${esc(p.emoji)}${
      p.count
        ? `<span class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">${p.count}</span>`
        : ""
    }</div><div class="mt-0.5 -ml-6 w-[88px] truncate text-center text-[10px] font-semibold text-slate-700 [text-shadow:0_0_3px_white,0_0_3px_white]">${esc(p.name)}</div>`,
  });
}

function memberIcon({ member, source }: MapMember, youLabel: string | null) {
  const face = member.photo
    ? `<img src="${esc(member.photo)}" alt="" class="h-9 w-9 rounded-full object-cover" />`
    : `<span class="flex h-9 w-9 items-center justify-center rounded-full ${member.color} text-sm font-bold text-white">${esc(member.name.slice(0, 1))}</span>`;
  const ring = source === "gps" ? "bg-emerald-500" : "bg-white";
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [48, 50], // 場所のアイコンと重なっても両方タップできるよう、少し左上にずらす
    popupAnchor: [-26, -50],
    html: `<div class="flex flex-col items-center"><div class="rounded-full p-[3px] shadow-lg ${ring}">${face}</div>${
      youLabel ? `<span class="-mt-1 rounded-full bg-slate-900 px-1.5 text-[9px] font-semibold text-white">${esc(youLabel)}</span>` : ""
    }</div>`,
  });
}

const draftIcon = L.divIcon({
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  html: '<div class="text-3xl leading-none drop-shadow">📍</div>',
});

export default function FamilyMap(props: Props) {
  const { places, members, youId, youLabel, draft, fallbackCenter, renderPlacePopup, renderMemberPopup } = props;
  const markers = useRef<Record<string, L.Marker | null>>({});

  // 最初の表示範囲：登録した場所と家族が全部入るように
  const points: [number, number][] = [
    ...places.map((p): [number, number] => [p.lat, p.lng]),
    ...members.map((m): [number, number] => [m.lat, m.lng]),
  ];
  const initial =
    points.length >= 2
      ? { bounds: L.latLngBounds(points).pad(0.2) }
      : { center: points[0] ?? ([fallbackCenter.lat, fallbackCenter.lng] as [number, number]), zoom: points.length ? 15 : 12 };

  return (
    <MapContainer
      {...initial}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
      style={{ cursor: props.pickMode ? "crosshair" : undefined }}
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <MapController {...props} markers={markers} />

      {places.map((p) => (
        <Marker
          key={`place-${p.id}`}
          position={[p.lat, p.lng]}
          icon={placeIcon(p)}
          ref={(m) => {
            markers.current[`place-${p.id}`] = m;
          }}
        >
          <Popup minWidth={220}>{renderPlacePopup(p.id)}</Popup>
        </Marker>
      ))}

      {members.map((m) => (
        <Marker
          key={`member-${m.member.id}`}
          position={[m.lat, m.lng]}
          icon={memberIcon(m, m.member.id === youId ? youLabel : null)}
          zIndexOffset={1000}
          ref={(mk) => {
            markers.current[`member-${m.member.id}`] = mk;
          }}
        >
          <Popup minWidth={220}>{renderMemberPopup(m.member.id)}</Popup>
        </Marker>
      ))}

      {draft && <Marker position={[draft.lat, draft.lng]} icon={draftIcon} zIndexOffset={2000} />}
    </MapContainer>
  );
}

// 地図のタップ（場所の登録）と、指定した場所への移動
function MapController({
  pickMode,
  onPick,
  focus,
  markers,
}: Props & { markers: React.RefObject<Record<string, L.Marker | null>> }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      if (pickMode) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  // 場所の登録・編集を始めたら、地図をタップしやすいように吹き出しを閉じる
  useEffect(() => {
    if (pickMode) map.closePopup();
  }, [pickMode, map]);

  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    if (focus.markerId) {
      const id = focus.markerId;
      map.once("moveend", () => markers.current[id]?.openPopup());
    }
  }, [focus, map, markers]);

  return null;
}
