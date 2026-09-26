"use client";

import { useState } from "react";
import { Home, KeyRound } from "lucide-react";
import { createFamily, emptyProfile, joinFamily, saveMyProfile } from "@/lib/profile/authStore";
import { useI18n } from "@/lib/i18n/useI18n";
import ProfileForm from "@/components/profile/ProfileForm";
import LanguageToggle from "@/components/common/LanguageToggle";
import { Field, inputClass, PrimaryButton, StepIndicator } from "./ui";

function Shell({ step, title, body, children }: { step: 2 | 3; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white px-6 pb-10 pt-4">
      <div className="mb-2 flex justify-end">
        <LanguageToggle />
      </div>
      <StepIndicator step={step} />
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{body}</p>
      {children}
    </div>
  );
}

// 新規登録 ステップ2：プロフィール（続柄は必須）
export function ProfileSetup() {
  const { t } = useI18n();
  return (
    <Shell step={2} title={t("pf.setupTitle")} body={t("pf.setupBody")}>
      <ProfileForm
        initial={{ ...emptyProfile(), relation: null }}
        submitLabel={t("auth.next")}
        onSubmit={(input) => saveMyProfile(input)}
      />
    </Shell>
  );
}

// 新規登録 ステップ3：家族グループを作る or 招待コードで参加
export function FamilySetup() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create") {
      if (!name.trim()) return setError(t("err.required"));
      createFamily(name);
    } else {
      if (!code.trim()) return setError(t("err.required"));
      const result = joinFamily(code);
      if (!result.ok) setError(t(`err.${result.error}`));
    }
  }

  return (
    <Shell step={3} title={t("fam.setupTitle")} body={t("fam.setupBody")}>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {(
          [
            ["create", Home, t("fam.create")],
            ["join", KeyRound, t("fam.join")],
          ] as const
        ).map(([m, Icon, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            aria-pressed={mode === m}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-sm font-semibold transition ${
              mode === m ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
            }`}
          >
            <Icon className="h-6 w-6" />
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "create" ? (
          <Field label={t("fam.name")} badge="required" error={error}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fam.namePlaceholder")}
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label={t("fam.code")} badge="required" error={error}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("fam.codePlaceholder")}
              autoCapitalize="characters"
              className={`${inputClass} font-mono tracking-[0.3em]`}
            />
          </Field>
        )}
        <PrimaryButton type="submit">{t(mode === "create" ? "fam.createButton" : "fam.joinButton")}</PrimaryButton>
      </form>
    </Shell>
  );
}
