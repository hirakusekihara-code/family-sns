"use client";

// ログイン・プロフィール・家族グループ（Supabase につながっています）
// 画面からは useAuth() で状態を読み、下の関数で操作します。

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { themeColors, type Account, type Family, type Profile, type Relation } from "./types";

// ---------- 画面から使う状態 ----------

export type AuthView =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "recovery" } // パスワード再設定メールのリンクから開いたとき
  | { status: "error"; message: string; setupNeeded: boolean }
  | {
      status: "signedIn";
      account: Account;
      profile: Profile | null; // null = プロフィール未作成
      family: Family | null; // null = 家族グループ未参加
      members: Profile[]; // 同じ家族のメンバー（自分を含む）
    };

let view: AuthView = { status: "loading" };
const listeners = new Set<() => void>();
let started = false;

function setView(next: AuthView) {
  view = next;
  listeners.forEach((l) => l());
}

const LOADING: AuthView = { status: "loading" };

function subscribe(callback: () => void) {
  listeners.add(callback);
  start();
  return () => {
    listeners.delete(callback);
  };
}

export function useAuth(): AuthView {
  return useSyncExternalStore(subscribe, () => view, () => LOADING);
}

// ---------- データベースの形 ⇔ アプリの形 ----------

type ProfileRow = {
  id: string;
  family_id: string | null;
  relation: Relation;
  relation_note: string;
  name: string;
  display_name: string;
  photo: string | null;
  phone: string;
  birthday: string | null;
  color: string;
  share_location: boolean;
  login_id: string | null;
  created_by: string | null;
};

type FamilyRow = { id: string; name: string; invite_code: string; created_by: string | null };

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  familyId: r.family_id,
  relation: r.relation,
  relationNote: r.relation_note,
  name: r.name,
  displayName: r.display_name,
  photo: r.photo,
  phone: r.phone,
  birthday: r.birthday ?? "",
  color: (themeColors as readonly string[]).includes(r.color) ? (r.color as Profile["color"]) : themeColors[0],
  shareLocation: r.share_location,
  loginId: r.login_id,
  createdBy: r.created_by,
});

const toFamily = (r: FamilyRow): Family => ({ id: r.id, name: r.name, inviteCode: r.invite_code, createdBy: r.created_by ?? "" });

export type ProfileInput = Omit<Profile, "id" | "familyId" | "createdBy" | "loginId">;

const toRow = (p: ProfileInput) => ({
  relation: p.relation,
  relation_note: p.relationNote,
  name: p.name,
  display_name: p.displayName,
  photo: p.photo,
  phone: p.phone,
  birthday: p.birthday || null,
  color: p.color,
  share_location: p.shareLocation,
});

// ---------- 読み込み ----------

// テーブルがまだ無い（SQL を実行していない）ときのエラーか
function isSetupError(error: { code?: string; message?: string }) {
  return error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message ?? "");
}

async function load(session: Session | null) {
  if (!session) return setView({ status: "signedOut" });
  const account: Account = { id: session.user.id, email: session.user.email ?? null };
  const db = supabase();

  const { data: me, error } = await db.from("profiles").select("*").eq("id", account.id).maybeSingle<ProfileRow>();
  if (error) return setView({ status: "error", message: error.message, setupNeeded: isSetupError(error) });
  if (!me) return setView({ status: "signedIn", account, profile: null, family: null, members: [] });

  const profile = toProfile(me);
  if (!profile.familyId) return setView({ status: "signedIn", account, profile, family: null, members: [] });

  const [familyRes, membersRes] = await Promise.all([
    db.from("families").select("*").eq("id", profile.familyId).maybeSingle<FamilyRow>(),
    db.from("profiles").select("*").eq("family_id", profile.familyId).order("created_at").returns<ProfileRow[]>(),
  ]);
  const err = familyRes.error ?? membersRes.error;
  if (err) return setView({ status: "error", message: err.message, setupNeeded: isSetupError(err) });

  setView({
    status: "signedIn",
    account,
    profile,
    family: familyRes.data ? toFamily(familyRes.data) : null,
    members: (membersRes.data ?? []).map(toProfile),
  });
}

function start() {
  if (started) return;
  started = true;
  const db = supabase();
  db.auth.onAuthStateChange((event, session) => {
    // この中で Supabase を直接呼ぶと処理が止まることがあるので、少し後で読み込む
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") return setView({ status: "recovery" });
      if (event === "TOKEN_REFRESHED") return; // 定期的な更新では読み込み直さない
      load(session);
    }, 0);
  });
}

// 画面の情報を読み込み直す（家族が増えたときなど）
export async function refreshAuth() {
  const { data } = await supabase().auth.getSession();
  await load(data.session);
}

// ---------- 操作 ----------

export type AuthError =
  | "emailTaken"
  | "loginIdTaken"
  | "invalidCredentials"
  | "wrongPassword"
  | "inviteNotFound"
  | "notAllowed"
  | "emailNotConfirmed"
  | "rateLimited"
  | "serverNotConfigured"
  | "unknown";

export type Result = { ok: true } | { ok: false; error: AuthError; detail?: string };

function authError(error: { code?: string; message?: string; status?: number }): Result {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "user_already_exists" || /already registered/i.test(message)) return { ok: false, error: "emailTaken" };
  if (code === "invalid_credentials" || /invalid login/i.test(message)) return { ok: false, error: "invalidCredentials" };
  if (code === "email_not_confirmed") return { ok: false, error: "emailNotConfirmed" };
  if (code.startsWith("over_") || error.status === 429) return { ok: false, error: "rateLimited" };
  if (/invite_not_found/.test(message)) return { ok: false, error: "inviteNotFound" };
  return { ok: false, error: "unknown", detail: message };
}

// 新規登録。確認メールが必要な設定のときは needsConfirmation が true になります
export async function signUp(email: string, password: string): Promise<Result & { needsConfirmation?: boolean }> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return authError(error);
  // すでに登録済みのメールでは、空のユーザーが返ってきます
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: "emailTaken" };
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(kind: "email" | "loginId", identifier: string, password: string): Promise<Result> {
  if (kind === "email") {
    const { error } = await supabase().auth.signInWithPassword({ email: identifier.trim(), password });
    return error ? authError(error) : { ok: true };
  }
  // 子どものアカウント：サーバーでログインIDからアカウントを探してログイン
  const res = await fetch("/api/kid-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: identifier.trim().toLowerCase(), password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (body.error as AuthError) ?? "unknown" };
  const { error } = await supabase().auth.setSession(body.session);
  return error ? authError(error) : { ok: true };
}

export async function signOut() {
  await supabase().auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<Result> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  return error ? authError(error) : { ok: true };
}

// パスワード再設定メールのリンクから開いたときに、新しいパスワードを保存
export async function setNewPassword(password: string): Promise<Result> {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) return authError(error);
  await refreshAuth();
  return { ok: true };
}

// 自分のプロフィールを作成・更新
export async function saveMyProfile(input: ProfileInput): Promise<Result> {
  if (view.status !== "signedIn") return { ok: false, error: "notAllowed" };
  const db = supabase();
  const { error } = view.profile
    ? await db.from("profiles").update({ ...toRow(input), updated_at: new Date().toISOString() }).eq("id", view.account.id)
    : await db.from("profiles").insert({ id: view.account.id, ...toRow(input) });
  if (error) return { ok: false, error: "unknown", detail: error.message };
  await refreshAuth();
  return { ok: true };
}

export async function createFamily(name: string): Promise<Result> {
  const { error } = await supabase().rpc("create_family", { family_name: name.trim() });
  if (error) return authError(error);
  await refreshAuth();
  return { ok: true };
}

export async function joinFamily(code: string): Promise<Result> {
  const { error } = await supabase().rpc("join_family", { code: code.trim().toUpperCase() });
  if (error) return authError(error);
  await refreshAuth();
  return { ok: true };
}

// 保護者が子どものアカウントを作る（サーバーで Secret key を使って作成）
export async function createChildAccount(loginId: string, password: string, input: ProfileInput): Promise<Result> {
  const { data } = await supabase().auth.getSession();
  const res = await fetch("/api/kids", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ loginId: loginId.trim().toLowerCase(), password, profile: toRow(input) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (body.error as AuthError) ?? "unknown", detail: body.detail };
  await refreshAuth();
  return { ok: true };
}

// パスワード変更（今のパスワードを確認してから変更）
export async function changePassword(current: string, next: string): Promise<Result> {
  if (view.status !== "signedIn" || !view.account.email) return { ok: false, error: "notAllowed" };
  const check = await supabase().auth.signInWithPassword({ email: view.account.email, password: current });
  if (check.error) return { ok: false, error: "wrongPassword" };
  const { error } = await supabase().auth.updateUser({ password: next });
  return error ? authError(error) : { ok: true };
}

// 新しいプロフィールの初期値
export function emptyProfile(colorIndex = 0): ProfileInput {
  return {
    relation: "father",
    relationNote: "",
    name: "",
    displayName: "",
    photo: null,
    phone: "",
    birthday: "",
    color: themeColors[colorIndex % themeColors.length],
    shareLocation: true,
  };
}
