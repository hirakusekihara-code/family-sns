"use client";

import { useState } from "react";
import { DatabaseZap, Users } from "lucide-react";
import { refreshAuth, setNewPassword, useAuth } from "@/lib/profile/authStore";
import { useI18n } from "@/lib/i18n/useI18n";
import AuthScreens from "./AuthScreens";
import { FamilySetup, ProfileSetup } from "./SetupScreens";
import { Field, PasswordInput, PrimaryButton, useResultMessage } from "./ui";

// ログイン状態に合わせて、表示する画面を切り替える
// 未ログイン → ログイン/新規登録、プロフィール未作成 → 作成、家族未参加 → 家族グループ、完了 → アプリ本体
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Users className="h-10 w-10 animate-pulse text-indigo-300" aria-label="Loading" />
      </div>
    );
  }
  if (auth.status === "error") return <ErrorScreen message={auth.message} setupNeeded={auth.setupNeeded} />;
  if (auth.status === "recovery") return <RecoveryScreen />;
  if (auth.status === "signedOut") return <AuthScreens />;
  if (!auth.profile) return <ProfileSetup />;
  if (!auth.family) return <FamilySetup />;
  return <>{children}</>;
}

// データベースの準備ができていない・読み込みに失敗したとき
function ErrorScreen({ message, setupNeeded }: { message: string; setupNeeded: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-8 text-center">
      <DatabaseZap className="h-12 w-12 text-amber-500" />
      <h1 className="text-xl font-bold text-slate-900">{t(setupNeeded ? "setup.dbTitle" : "setup.errorTitle")}</h1>
      <p className="text-sm text-slate-600">{setupNeeded ? t("setup.dbBody") : message}</p>
      <div className="w-full">
        <PrimaryButton type="button" onClick={() => refreshAuth()}>
          {t("setup.retry")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// パスワード再設定メールのリンクから開いたとき
function RecoveryScreen() {
  const { t } = useI18n();
  const resultMessage = useResultMessage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(t("err.password"));
    setBusy(true);
    const result = await setNewPassword(password);
    setBusy(false);
    setError(resultMessage(result));
  }

  return (
    <div className="min-h-screen bg-white px-6 pt-16">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("auth.recoveryTitle")}</h1>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t("acc.newPassword")} hint={t("auth.passwordHint")} error={error}>
          <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <PrimaryButton type="submit" disabled={busy}>
          {t("common.save")}
        </PrimaryButton>
      </form>
    </div>
  );
}
