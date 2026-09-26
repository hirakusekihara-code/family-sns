"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { resizeImage } from "@/lib/profile/image";
import {
  displayNameOf,
  relations,
  roleOf,
  themeColors,
  type Relation,
} from "@/lib/profile/types";
import type { ProfileInput } from "@/lib/profile/authStore";
import { useI18n } from "@/lib/i18n/useI18n";
import { Field, inputClass, PrimaryButton } from "@/components/auth/ui";
import ProfilePhoto from "./ProfilePhoto";

// 入力途中のプロフィール（続柄は未選択を許す）
export type ProfileDraft = Omit<ProfileInput, "relation"> & { relation: Relation | null };

type Props = {
  initial: ProfileDraft;
  relationOptions?: readonly Relation[]; // 子どものアカウントでは「息子・娘」だけ
  submitLabel: string;
  // 保存に失敗したときはエラー文を返すと、フォームの下に表示します
  onSubmit: (input: ProfileInput) => void | string | null | Promise<void | string | null>;
  extraFields?: React.ReactNode; // ログインIDなど、フォームの最初に足す欄
  extraValid?: boolean; // 追加欄の入力チェック結果
  onInvalidSubmit?: () => void;
};

// プロフィールの入力フォーム（新規登録・編集・子どものアカウント作成で共通）
export default function ProfileForm({
  initial,
  relationOptions = relations,
  submitLabel,
  onSubmit,
  extraFields,
  extraValid = true,
  onInvalidSubmit,
}: Props) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = {
    relation: draft.relation ? null : t("err.relation"),
    name: draft.name.trim() ? null : t("err.required"),
    phone: !draft.phone || /^[\d+\-\s()]+$/.test(draft.phone) ? null : t("err.phone"),
  };
  const valid = !errors.relation && !errors.name && !errors.phone;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !extraValid) {
      setShowErrors(true);
      onInvalidSubmit?.();
      return;
    }
    setSaving(true);
    try {
      const error = await onSubmit({
        ...draft,
        relation: draft.relation!,
        name: draft.name.trim(),
        displayName: draft.displayName.trim(),
      });
      setSubmitError(error || null);
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    update({ photo: await resizeImage(file) });
  }

  const shownError = (key: keyof typeof errors) => (showErrors ? errors[key] : null);
  const defaultName = draft.relation
    ? displayNameOf({ displayName: "", relation: draft.relation, name: draft.name || "—" }, lang)
    : "—";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {extraFields}

      {/* 顔写真 */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t("pf.choosePhoto")}
          className="relative"
        >
          <ProfilePhoto profile={draft} label={draft.name || "?"} size="xl" />
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">
            {t("pf.photo")} <span className="text-xs font-normal text-slate-400">({t("pf.optional")})</span>
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} className="block text-sm font-semibold text-indigo-600">
            {t("pf.choosePhoto")}
          </button>
          {draft.photo && (
            <button
              type="button"
              onClick={() => update({ photo: null })}
              className="flex items-center gap-1 text-xs text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
              {t("pf.removePhoto")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* 続柄（必須） */}
      <div>
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
          {t("pf.relation")}
          <span className="rounded bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-600">{t("pf.required")}</span>
        </p>
        <p className="mb-2 text-xs text-slate-400">{t("pf.relationHint")}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("pf.relation")}>
          {relationOptions.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={draft.relation === r}
              onClick={() => update({ relation: r })}
              className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                draft.relation === r
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {t(`rel.${r}`)}
            </button>
          ))}
        </div>
        {shownError("relation") && <p className="mt-1 text-xs text-rose-600">{errors.relation}</p>}
        {draft.relation && (
          <p className="mt-2 text-xs text-slate-500">→ {t(`pf.role.${roleOf(draft.relation)}`)}</p>
        )}
        {draft.relation === "other" && (
          <input
            value={draft.relationNote}
            onChange={(e) => update({ relationNote: e.target.value })}
            placeholder={t("pf.relationNotePlaceholder")}
            aria-label={t("pf.relationNote")}
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      <Field label={t("pf.name")} badge="required" error={shownError("name")}>
        <input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={t("pf.namePlaceholder")}
          autoComplete="name"
          className={inputClass}
        />
      </Field>

      <Field label={t("pf.displayName")} badge="optional" hint={t("pf.displayNameHint", { name: defaultName })}>
        <input
          value={draft.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          placeholder={defaultName}
          className={inputClass}
        />
      </Field>

      <Field label={t("pf.phone")} badge="optional" error={shownError("phone")}>
        <input
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => update({ phone: e.target.value })}
          placeholder={t("pf.phonePlaceholder")}
          autoComplete="tel"
          className={inputClass}
        />
      </Field>

      <Field label={t("pf.birthday")} badge="optional">
        <input
          type="date"
          value={draft.birthday}
          onChange={(e) => update({ birthday: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">{t("pf.color")}</p>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("pf.color")}>
          {themeColors.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={draft.color === c}
              aria-label={c.replace("bg-", "").replace("-500", "")}
              onClick={() => update({ color: c })}
              className={`h-9 w-9 rounded-full ${c} ${draft.color === c ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{t("pf.shareLocation")}</p>
          <p className="text-xs text-slate-400">{t("pf.shareLocationHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.shareLocation}
          aria-label={t("pf.shareLocation")}
          onClick={() => update({ shareLocation: !draft.shareLocation })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${draft.shareLocation ? "bg-indigo-600" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              draft.shareLocation ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {submitError && (
        <p className="text-sm text-rose-600" role="alert">
          {submitError}
        </p>
      )}
      <PrimaryButton type="submit" disabled={saving}>
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}
