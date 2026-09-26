"use client";

import { useState } from "react";
import { ChevronLeft, MailCheck, Users } from "lucide-react";
import { requestPasswordReset, signIn, signUp } from "@/lib/profile/authStore";
import { useI18n } from "@/lib/i18n/useI18n";
import LanguageToggle from "@/components/common/LanguageToggle";
import { Field, inputClass, isEmail, PasswordInput, PrimaryButton, StepIndicator, useResultMessage } from "./ui";

type Mode = "login" | "signup" | "reset";

// ログインしていないときの画面（ログイン・新規登録・パスワード再設定）
export default function AuthScreens() {
  const [mode, setMode] = useState<Mode>("login");
  return (
    <div className="min-h-screen bg-white px-6 pb-10 pt-4">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      {mode === "login" && <LoginForm onSignup={() => setMode("signup")} onReset={() => setMode("reset")} />}
      {mode === "signup" && <SignupForm onBack={() => setMode("login")} />}
      {mode === "reset" && <ResetForm onBack={() => setMode("login")} />}
    </div>
  );
}

function Logo() {
  const { t } = useI18n();
  return (
    <div className="mb-8 mt-6 flex flex-col items-center gap-2 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
        <Users className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-bold text-slate-900">Family SNS</h1>
      <p className="text-sm text-slate-500">{t("auth.tagline")}</p>
    </div>
  );
}

function LoginForm({ onSignup, onReset }: { onSignup: () => void; onReset: () => void }) {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [kind, setKind] = useState<"email" | "loginId">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await signIn(kind, identifier, password);
    setBusy(false);
    setError(resultMessage(result));
  }

  return (
    <>
      <Logo />
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["email", "loginId"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setIdentifier("");
              setError(null);
            }}
            aria-pressed={kind === k}
            className={`rounded-lg py-2 transition ${kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {t(k === "email" ? "auth.tab.email" : "auth.tab.child")}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t(kind === "email" ? "auth.email" : "auth.loginId")}>
          <input
            type={kind === "email" ? "email" : "text"}
            inputMode={kind === "email" ? "email" : "text"}
            autoComplete="username"
            autoCapitalize="none"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("auth.password")}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || !identifier || !password}>
          {t("auth.login")}
        </PrimaryButton>
      </form>
      {kind === "email" ? (
        <button type="button" onClick={onReset} className="mt-3 w-full text-center text-sm text-indigo-600">
          {t("auth.forgot")}
        </button>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-500">{t("auth.childHint")}</p>
      )}
      <div className="mt-8 border-t border-slate-100 pt-6 text-center">
        <p className="mb-2 text-sm text-slate-500">{t("auth.noAccount")}</p>
        <button
          type="button"
          onClick={onSignup}
          className="w-full rounded-xl border border-indigo-200 py-3 text-[15px] font-semibold text-indigo-700"
        >
          {t("auth.signup")}
        </button>
      </div>
    </>
  );
}

// 新規登録 ステップ1：メールとパスワード（ステップ2・3は AuthGate が続けて表示）
function SignupForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [sentTo, setSentTo] = useState<string | null>(null); // 確認メールを送った先
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    email: isEmail(email) ? null : t("err.email"),
    password: password.length >= 8 ? null : t("err.password"),
    confirm: confirm === password ? null : t("err.passwordMatch"),
  };
  const valid = !errors.email && !errors.password && !errors.confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setShowErrors(true);
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    setServerError(resultMessage(result));
    if (result.ok && result.needsConfirmation) setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <MailCheck className="h-14 w-14 text-indigo-500" />
        <h1 className="text-2xl font-bold text-slate-900">{t("auth.checkEmailTitle")}</h1>
        <p className="text-sm text-slate-600">{t("auth.checkEmailBody", { email: sentTo })}</p>
        <button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-indigo-600">
          {t("auth.login")}
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-2 mb-4 flex items-center text-sm text-slate-600">
        <ChevronLeft className="h-5 w-5" />
        {t("auth.back")}
      </button>
      <StepIndicator step={1} />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("auth.signup")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label={t("auth.email")} badge="required" error={showErrors ? errors.email : null}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label={t("auth.password")}
          badge="required"
          hint={t("auth.passwordHint")}
          error={showErrors ? errors.password : null}
        >
          <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t("auth.passwordConfirm")} badge="required" error={showErrors ? errors.confirm : null}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
        <PrimaryButton type="submit" disabled={busy}>
          {t("auth.next")}
        </PrimaryButton>
      </form>
      <button type="button" onClick={onBack} className="mt-6 w-full text-center text-sm text-slate-500">
        {t("auth.haveAccount")} <span className="font-semibold text-indigo-600">{t("auth.login")}</span>
      </button>
    </>
  );
}

function ResetForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-2 mb-4 flex items-center text-sm text-slate-600">
        <ChevronLeft className="h-5 w-5" />
        {t("auth.back")}
      </button>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{t("auth.resetTitle")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("auth.resetBody")}</p>
      {sent ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          {t("auth.resetSent", { email })}
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isEmail(email)) return setError(t("err.email"));
            const result = await requestPasswordReset(email);
            setError(resultMessage(result));
            if (result.ok) setSent(true);
          }}
          className="space-y-4"
          noValidate
        >
          <Field label={t("auth.email")} error={error}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <PrimaryButton type="submit">{t("auth.resetSend")}</PrimaryButton>
        </form>
      )}
    </>
  );
}
