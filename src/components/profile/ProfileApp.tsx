"use client";

import { useState } from "react";
import { Cake, Check, ChevronDown, Copy, KeyRound, LogOut, Mail, Phone, Send, UserPlus } from "lucide-react";
import {
  changePassword,
  createChildAccount,
  emptyProfile,
  signOut,
  saveMyProfile,
  useAuth,
} from "@/lib/profile/authStore";
import { displayNameOf, roleOf, type Profile } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/useI18n";
import { Field, inputClass, PasswordInput, PrimaryButton, useResultMessage } from "@/components/auth/ui";
import LanguageToggle from "@/components/common/LanguageToggle";
import ProfileForm from "./ProfileForm";
import ProfilePhoto from "./ProfilePhoto";

// マイページ：プロフィール・家族・アカウント
export default function ProfileApp() {
  const auth = useAuth();
  const { t, lang } = useI18n();
  const resultMessage = useResultMessage();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (auth.status !== "signedIn" || !auth.profile || !auth.family) return null; // AuthGate が先に処理します
  const { account, profile, family, members } = auth;
  const isParent = roleOf(profile.relation) === "parent";

  const relationLabel = (p: Profile) =>
    p.relation === "other" && p.relationNote ? `${t("rel.other")}（${p.relationNote}）` : t(`rel.${p.relation}`);

  return (
    <div className="space-y-4 p-4">
      {notice && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          <Check className="h-4 w-4" />
          {notice}
        </p>
      )}

      {/* プロフィール */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {editing ? (
          <>
            <h2 className="mb-4 text-base font-semibold text-slate-900">{t("pf.edit")}</h2>
            <ProfileForm
              initial={profile}
              submitLabel={t("pf.save")}
              onSubmit={async (input) => {
                const result = await saveMyProfile(input);
                if (!result.ok) return resultMessage(result);
                setEditing(false);
                setNotice(t("pf.saved"));
              }}
            />
            <button type="button" onClick={() => setEditing(false)} className="mt-3 w-full text-sm text-slate-500">
              {t("auth.back")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <ProfilePhoto profile={profile} label={displayNameOf(profile, lang)} size="xl" />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold text-slate-900">{displayNameOf(profile, lang)}</p>
                <p className="text-sm text-slate-600">
                  {relationLabel(profile)} · {family.name}
                </p>
                <p className="text-xs text-slate-400">{t(`pf.role.${roleOf(profile.relation)}`)}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <InfoRow icon={<span className="text-xs font-semibold">Aa</span>} label={t("pf.name")} value={profile.name} />
              {/* 子どものアカウントはログインIDを表示（メールは保護者のアドレスをもとにした内部用のもの） */}
              {profile.loginId ? (
                <InfoRow icon={<KeyRound className="h-4 w-4" />} label={t("auth.loginId")} value={profile.loginId} />
              ) : (
                account.email && <InfoRow icon={<Mail className="h-4 w-4" />} label={t("auth.email")} value={account.email} />
              )}
              {profile.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label={t("pf.phone")} value={profile.phone} />}
              {profile.birthday && (
                <InfoRow icon={<Cake className="h-4 w-4" />} label={t("pf.birthday")} value={profile.birthday.replaceAll("-", "/")} />
              )}
            </dl>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setNotice(null);
              }}
              className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
            >
              {t("pf.edit")}
            </button>
          </>
        )}
      </section>

      {/* 家族 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{family.name}</h2>
        <p className="mb-3 text-xs text-slate-500">{t("fam.members", { n: members.length })}</p>
        <ul className="space-y-3">
          {members.map((m) => {
            const creator = m.createdBy ? members.find((x) => x.id === m.createdBy) : null;
            return (
              <li key={m.id} className="flex items-center gap-3">
                <ProfilePhoto profile={m} label={displayNameOf(m, lang)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {displayNameOf(m, lang)}
                    {m.id === profile.id && <span className="ml-1 text-xs font-normal text-slate-400">({t("fam.you")})</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {relationLabel(m)} · {m.name}
                    {creator && ` · ${t("fam.createdByParent", { name: displayNameOf(creator, lang) })}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <InviteCode familyName={family.name} code={family.inviteCode} />
      </section>

      {/* 子どものアカウント（保護者のみ） */}
      {isParent && <ChildAccountSection onCreated={setNotice} />}

      {/* アカウント */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t("acc.title")}</h2>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">{t("lang.label")}</span>
          <LanguageToggle />
        </div>
        <p className="mb-3 text-sm text-slate-600">
          {t("acc.loginWith")}：{profile.loginId ?? account.email}
        </p>
        <PasswordSection onChanged={() => setNotice(t("acc.passwordChanged"))} />
        <button
          type="button"
          onClick={() => window.confirm(t("acc.logoutConfirm")) && signOut()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          {t("acc.logout")}
        </button>
      </section>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 truncate text-slate-800">{value}</dd>
    </div>
  );
}

function InviteCode({ familyName, code }: { familyName: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const text = t("fam.shareText", { family: familyName, code });

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーできない環境では、コードを長押しでコピーしてもらう
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-indigo-50 p-3">
      <p className="text-sm font-semibold text-indigo-900">{t("fam.inviteTitle")}</p>
      <p className="mb-2 text-xs text-indigo-800/80">{t("fam.inviteBody")}</p>
      <div className="flex items-center gap-2">
        <span className="flex-1 select-all rounded-lg bg-white px-3 py-2 text-center font-mono text-xl font-bold tracking-[0.3em] text-slate-900">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-indigo-700"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {t(copied ? "fam.copied" : "fam.copy")}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            onClick={() => navigator.share({ text }).catch(() => {})}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white"
          >
            <Send className="h-4 w-4" />
            {t("fam.share")}
          </button>
        )}
      </div>
    </div>
  );
}

// 保護者が子どものアカウント（ログインID＋パスワード）を作る
function ChildAccountSection({ onCreated }: { onCreated: (message: string) => void }) {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const loginIdError = /^[a-zA-Z0-9_]{3,20}$/.test(loginId) ? null : t("err.loginIdFormat");
  const passwordError = password.length >= 8 ? null : t("err.password");

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <UserPlus className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-semibold text-slate-900">{t("child.title")}</span>
          <span className="block text-xs text-slate-500">{t("child.body")}</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <ProfileForm
            key={formKey}
            initial={{ ...emptyProfile(2), relation: null }}
            relationOptions={["son", "daughter"]}
            submitLabel={t("child.create")}
            extraValid={!loginIdError && !passwordError}
            onInvalidSubmit={() => setShowErrors(true)}
            extraFields={
              <div className="space-y-4 rounded-xl bg-slate-50 p-3">
                <Field label={t("auth.loginId")} badge="required" error={showErrors ? loginIdError : null}>
                  <input
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={t("child.loginIdPlaceholder")}
                    autoCapitalize="none"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t("auth.password")}
                  badge="required"
                  hint={t("auth.passwordHint")}
                  error={showErrors ? passwordError : null}
                >
                  <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
              </div>
            }
            onSubmit={async (input) => {
              const result = await createChildAccount(loginId, password, input);
              if (!result.ok) {
                setServerError(resultMessage(result));
                return;
              }
              onCreated(t("child.created", { name: input.name, id: loginId.toLowerCase() }));
              setLoginId("");
              setPassword("");
              setShowErrors(false);
              setServerError(null);
              setFormKey((k) => k + 1);
              setOpen(false);
            }}
          />
        </div>
      )}
    </section>
  );
}

function PasswordSection({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError(t("err.password"));
    const result = await changePassword(current, next);
    if (!result.ok) return setError(resultMessage(result));
    setCurrent("");
    setNext("");
    setError(null);
    setOpen(false);
    onChanged();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
      >
        <KeyRound className="h-4 w-4" />
        {t("acc.changePassword")}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-3" noValidate>
      <Field label={t("acc.currentPassword")}>
        <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label={t("acc.newPassword")} hint={t("auth.passwordHint")}>
        <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <PrimaryButton type="submit">{t("acc.changePassword")}</PrimaryButton>
      <button type="button" onClick={() => setOpen(false)} className="w-full text-sm text-slate-500">
        {t("auth.back")}
      </button>
    </form>
  );
}
