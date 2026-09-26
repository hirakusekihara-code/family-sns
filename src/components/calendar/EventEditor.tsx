"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Clock,
  FileText,
  MapPin,
  Paperclip,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createId } from "@/lib/mockData";
import type { Place, PlaceInfo } from "@/lib/placesStore";
import {
  attachmentKinds,
  categories,
  defaultLedgerFor,
  findLedger,
  type Attachment,
  type AttachmentKind,
  type CalendarEvent,
  type Ledger,
  type MoneyType,
} from "@/lib/calendarData";
import { useFamily } from "@/lib/family";
import { signedUrls } from "@/lib/calendarStore";
import { useI18n } from "@/lib/i18n/useI18n";

type Props = {
  event: CalendarEvent;
  isNew: boolean;
  ledgers: Ledger[]; // 自分が使える帳簿
  allLedgers: Ledger[];
  places: Place[]; // 家族がマップで登録した場所
  placeOf: (id: string | undefined) => PlaceInfo | undefined;
  onSave: (event: CalendarEvent) => Promise<string | null>; // 失敗したらエラー文
  onDelete: (event: CalendarEvent) => Promise<string | null>;
  onClose: () => void;
};

// 予定の登録・編集（Googleカレンダー風の全画面シート）
export default function EventEditor({ event, isNew, ledgers, allLedgers, places, placeOf, onSave, onDelete, onClose }: Props) {
  const { t, categoryLabel, ledgerName } = useI18n();
  const family = useFamily();
  const [draft, setDraft] = useState<CalendarEvent>(event);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 保存済みの添付ファイルを開くための一時URLを用意
  useEffect(() => {
    let active = true;
    signedUrls(event.attachments).then((urls) => {
      if (!active) return;
      setDraft((d) => ({ ...d, attachments: d.attachments.map((a) => (urls[a.id] ? { ...a, url: urls[a.id] } : a)) }));
    });
    return () => {
      active = false;
    };
  }, [event.attachments]);

  if (!family.ready) return null;
  const member = family.member;

  const update = (patch: Partial<CalendarEvent>) => setDraft((d) => ({ ...d, ...patch }));

  // 選べる帳簿：使える帳簿 + いま設定されている帳簿
  const ledgerOptions = [...ledgers];
  if (draft.money && !ledgerOptions.some((l) => l.id === draft.money!.ledgerId)) {
    ledgerOptions.push(findLedger(allLedgers, draft.money.ledgerId));
  }
  const canUseMoney = ledgers.length > 0 || !!draft.money;

  // 選べる場所：家族が登録した場所（＋以前の予定で使っていた場所）
  const placeOptions: PlaceInfo[] = [...places];
  const current = placeOf(draft.spotId);
  if (current && !placeOptions.some((p) => p.id === current.id)) placeOptions.push(current);

  const titleMissing = draft.title.trim() === "";
  const amountMissing = !!draft.money && draft.money.amount <= 0;

  function changeAssignee(assigneeId: string) {
    setDraft((d) => {
      // お金の帳簿が「前の担当者の標準帳簿」のままなら、新しい担当者の標準帳簿に合わせる
      let money = d.money;
      if (money && money.ledgerId === defaultLedgerFor(member(d.assigneeId))) {
        const next = defaultLedgerFor(member(assigneeId));
        if (ledgers.some((l) => l.id === next)) money = { ...money, ledgerId: next };
      }
      return { ...d, assigneeId, money };
    });
  }

  function changeMoneyType(type: MoneyType | "none") {
    if (type === "none") return update({ money: undefined });
    const current = draft.money;
    const preferred = defaultLedgerFor(member(draft.assigneeId));
    const ledgerId = current?.ledgerId ?? (ledgers.some((l) => l.id === preferred) ? preferred : ledgers[0].id);
    // 科目の初期値：お小遣い帳への入金なら「お小遣い」、それ以外は一覧の先頭
    const fallback = type === "income" && ledgerId.startsWith("allowance-") ? "allowance" : categories[type][0];
    const category = current && categories[type].includes(current.category) ? current.category : fallback;
    update({ money: { type, amount: current?.amount ?? 0, category, ledgerId } });
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const kind: AttachmentKind = draft.money?.type === "expense" ? "receipt" : "other";
    const added: Attachment[] = Array.from(files).map((file) => ({
      id: createId("file"),
      name: file.name,
      kind,
      url: URL.createObjectURL(file), // 保存前のプレビュー用
      mimeType: file.type,
      file, // 保存するときに Supabase にアップロード
    }));
    update({ attachments: [...draft.attachments, ...added] });
  }

  function removeAttachment(id: string) {
    const target = draft.attachments.find((a) => a.id === id);
    if (target?.url?.startsWith("blob:")) URL.revokeObjectURL(target.url);
    update({ attachments: draft.attachments.filter((a) => a.id !== id) });
  }

  async function handleSave() {
    if (titleMissing || amountMissing) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSaveError(await onSave({ ...draft, title: draft.title.trim() }));
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm(t("ed.deleteConfirm"))) return;
    setSaving(true);
    setSaveError(await onDelete(event));
    setSaving(false);
  }

  const creator = member(draft.createdById);

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-2 py-2">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-slate-100">
          <X className="h-6 w-6 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white active:scale-95 disabled:bg-slate-300"
        >
          {saving ? t("pl.generating") : t("common.save")}
        </button>
      </div>

      {saveError && (
        <p className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {saveError}
        </p>
      )}
      <div className="flex-1 overflow-y-auto pb-10">
        {/* タイトル */}
        <div className="pl-14 pr-4">
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder={t("ed.titlePlaceholder")}
            autoFocus={isNew}
            className="w-full border-b border-slate-200 py-3 text-2xl text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500"
          />
          {showErrors && titleMissing && <p className="mt-1 text-xs text-rose-600">{t("ed.needTitle")}</p>}
        </div>

        {/* 担当 */}
        <Row icon={Users} label={t("ed.assignee")}>
          <div className="flex flex-wrap gap-2">
            {family.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => changeAssignee(m.id)}
                aria-pressed={draft.assigneeId === m.id}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${
                  draft.assigneeId === m.id
                    ? `${m.color} border-transparent text-white`
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">{t("ed.createdBy", { name: creator.name })}</p>
        </Row>

        {/* 日時 */}
        <Row icon={Clock} label={t("ed.date")}>
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-slate-800">{t("cal.allDay")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.allDay}
              aria-label={t("cal.allDay")}
              onClick={() => update({ allDay: !draft.allDay })}
              className={`relative h-6 w-11 rounded-full transition ${draft.allDay ? "bg-indigo-600" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  draft.allDay ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => e.target.value && update({ date: e.target.value })}
            aria-label={t("ed.date")}
            className="mt-3 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
          />
          {!draft.allDay && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                {t("ed.start")}
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => update({ start: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
                />
              </label>
              <label className="text-xs text-slate-500">
                {t("ed.end")}
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => update({ end: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
                />
              </label>
            </div>
          )}
        </Row>

        {/* 場所 */}
        <Row icon={MapPin} label={t("ed.place")}>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {placeOptions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  draft.spotId === s.id ? update({ spotId: undefined, place: "" }) : update({ spotId: s.id, place: "" })
                }
                aria-pressed={draft.spotId === s.id}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm transition ${
                  draft.spotId === s.id
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
          {placeOptions.length === 0 && <p className="text-xs text-slate-400">{t("ed.noPlaces")}</p>}
          {!draft.spotId && (
            <input
              value={draft.place}
              onChange={(e) => update({ place: e.target.value })}
              placeholder={t("ed.placePlaceholder")}
              className="mt-2 w-full border-b border-slate-200 py-2 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-500"
            />
          )}
        </Row>

        {/* メモ */}
        <Row icon={AlignLeft}>
          <textarea
            value={draft.memo}
            onChange={(e) => update({ memo: e.target.value })}
            placeholder={t("ed.memoPlaceholder")}
            rows={2}
            className="w-full resize-none border-b border-slate-200 py-2 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-500"
          />
        </Row>

        {/* お金（家計簿）：使える帳簿がある人だけ */}
        {canUseMoney && (
          <>
        <Row icon={Wallet} label={t("ed.money")}>
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {(
              [
                ["none", t("ed.moneyNone")],
                ["expense", t("money.expense")],
                ["income", t("money.income")],
              ] as const
            ).map(([type, label]) => {
              const active = (draft.money?.type ?? "none") === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => changeMoneyType(type)}
                  aria-pressed={active}
                  className={`rounded-lg py-1.5 transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {draft.money && (
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-slate-500">
                {t("ed.amount")}
                <div className="mt-1 flex items-center rounded-lg bg-slate-100 px-3">
                  <span className="text-lg text-slate-500">¥</span>
                  <input
                    inputMode="numeric"
                    value={draft.money.amount ? draft.money.amount.toLocaleString("ja-JP") : ""}
                    onChange={(e) => {
                      const amount = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                      update({ money: { ...draft.money!, amount } });
                    }}
                    placeholder="0"
                    className="w-full bg-transparent px-2 py-2 text-right text-xl font-semibold text-slate-900 outline-none"
                  />
                </div>
              </label>
              {showErrors && amountMissing && <p className="text-xs text-rose-600">{t("ed.needAmount")}</p>}

              <div>
                <p className="text-xs text-slate-500">{t("ed.category")}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {categories[draft.money.type].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update({ money: { ...draft.money!, category: c } })}
                      aria-pressed={draft.money!.category === c}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        draft.money!.category === c
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {categoryLabel(c)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs text-slate-500">
                {t("ed.ledger")}
                <select
                  value={draft.money.ledgerId}
                  onChange={(e) => update({ money: { ...draft.money!, ledgerId: e.target.value } })}
                  className="mt-1 w-full rounded-lg bg-slate-100 px-3 py-2 text-[15px] text-slate-800 outline-none"
                >
                  {ledgerOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.emoji} {ledgerName(l)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </Row>

          </>
        )}

        {/* 添付ファイル */}
        <Row icon={Paperclip} label={t("ed.attachments")}>
          <ul className="space-y-2">
            {draft.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${t("ed.open")}: ${a.name}`}
                  className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100"
                >
                  {a.mimeType.startsWith("image/") && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ブラウザ内の一時URLを表示するため
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-6 w-6 text-slate-500" />
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{a.name}</p>
                  <select
                    value={a.kind}
                    onChange={(e) =>
                      update({
                        attachments: draft.attachments.map((x) =>
                          x.id === a.id ? { ...x, kind: e.target.value as AttachmentKind } : x,
                        ),
                      })
                    }
                    className="mt-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {attachmentKinds.map((k) => (
                      <option key={k} value={k}>
                        {t(`attach.${k}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`${t("common.remove")}: ${a.name}`}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Paperclip className="h-4 w-4" />
            {t("ed.attach")}
          </button>
          <p className="mt-1 text-xs text-slate-400">{t("ed.attachHint")}</p>
        </Row>

        {!isNew && (
          <div className="px-4 pt-6">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 py-2.5 text-sm font-medium text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
              {t("ed.delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 左にアイコン、右に入力欄が並ぶ1行（Googleカレンダーの編集画面風）
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 border-b border-slate-100 px-4 py-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        {label && <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>}
        {children}
      </div>
    </div>
  );
}
