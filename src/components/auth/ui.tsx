"use client";

import { cloneElement, isValidElement, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/useI18n";

// フォームの共通部品（ラベル・入力欄・ボタン）

export function Field({
  label,
  badge,
  hint,
  error,
  children,
}: {
  label: string;
  badge?: "required" | "optional";
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  // 入力欄に id を付けてラベルと結び付ける（ラベル＝読み上げられる名前は項目名だけにする）
  const control = isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children;
  return (
    <div>
      <label htmlFor={id} className="block">
        <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
          {label}
          {badge && (
            <span
              aria-hidden
              className={`rounded px-1.5 py-px text-[10px] font-semibold ${
                badge === "required" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              {t(badge === "required" ? "pf.required" : "pf.optional")}
            </span>
          )}
        </span>
      </label>
      {control}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={t("auth.showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-xl bg-indigo-600 py-3 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300"
    >
      {children}
    </button>
  );
}

export function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useI18n();
  const labels = [t("auth.step1"), t("auth.step2"), t("auth.step3")];
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-medium text-indigo-600">{t("auth.step", { n: step })}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {labels.map((label, i) => (
          <div key={label}>
            <div className={`h-1.5 rounded-full ${i < step ? "bg-indigo-600" : "bg-slate-200"}`} />
            <p className={`mt-1 text-[11px] ${i < step ? "text-slate-700" : "text-slate-400"}`}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// 操作結果のエラーを、画面に出す文章にする
export function useResultMessage() {
  const { t } = useI18n();
  return (result: { ok: true } | { ok: false; error: string; detail?: string }) => {
    if (result.ok) return null;
    const text = t(`err.${result.error}` as MessageKey);
    return result.error === "unknown" && result.detail ? `${text}（${result.detail}）` : text;
  };
}
