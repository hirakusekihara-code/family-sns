"use client";

// ログイン・プロフィール・家族グループの保存場所（仮）
// ------------------------------------------------------------
// 今はこのブラウザの中（localStorage）だけに保存しています。
// 次のステップで Supabase につなぐと、同じ関数の中身が
// 「インターネット上のデータベースに保存する処理」に置き換わります。
// ------------------------------------------------------------

import { useSyncExternalStore } from "react";
import { createId } from "@/lib/mockData";
import { themeColors, type Account, type Family, type Profile } from "./types";

type AuthState = {
  accounts: Account[];
  profiles: Profile[];
  families: Family[];
  sessionAccountId: string | null; // ログイン中のアカウント
};

const STORAGE_KEY = "family-sns-auth-v1";
const EMPTY: AuthState = { accounts: [], profiles: [], families: [], sessionAccountId: null };

let cache: AuthState | null = null;
const listeners = new Set<() => void>();

function load(): AuthState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

function save(next: AuthState) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、この画面を開いている間は使えます
  }
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// ---------- 画面から使う情報 ----------

export type AuthView =
  | { status: "loading" }
  | { status: "signedOut" }
  | {
      status: "signedIn";
      account: Account;
      profile: Profile | null; // null = プロフィール未作成
      family: Family | null; // null = 家族グループ未参加
      members: Profile[]; // 同じ家族のメンバー（自分を含む）
    };

let lastState: AuthState | null = null;
let lastView: AuthView = { status: "loading" };

function toView(state: AuthState): AuthView {
  if (state === lastState) return lastView;
  lastState = state;
  const account = state.accounts.find((a) => a.id === state.sessionAccountId);
  if (!account) {
    lastView = { status: "signedOut" };
    return lastView;
  }
  const profile = state.profiles.find((p) => p.id === account.profileId) ?? null;
  const family = state.families.find((f) => f.id === profile?.familyId) ?? null;
  const members = family ? state.profiles.filter((p) => p.familyId === family.id) : [];
  lastView = { status: "signedIn", account, profile, family, members };
  return lastView;
}

const LOADING: AuthView = { status: "loading" };

export function useAuth(): AuthView {
  return useSyncExternalStore(
    subscribe,
    () => toView(load()),
    () => LOADING, // サーバーでは「読み込み中」として表示
  );
}

// ---------- パスワード（そのままでは保存しない） ----------

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // 暗号機能が使えない環境（http で開いた場合など）の簡易版
  let h = 0;
  for (const b of data) h = (Math.imul(31, h) + b) | 0;
  return `weak-${h}`;
}

// ---------- 操作 ----------

export type AuthError =
  | "emailTaken"
  | "loginIdTaken"
  | "invalidCredentials"
  | "wrongPassword"
  | "inviteNotFound"
  | "notAllowed";

type Result = { ok: true } | { ok: false, error: AuthError };

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeLoginId = (id: string) => id.trim().toLowerCase();

// 新規登録（メール＋パスワード）→ そのままログイン状態にします
export async function signUp(email: string, password: string): Promise<Result> {
  const state = load();
  const normalized = normalizeEmail(email);
  if (state.accounts.some((a) => a.email === normalized)) return { ok: false, error: "emailTaken" };
  const id = createId("account");
  const account: Account = {
    id,
    email: normalized,
    loginId: null,
    passwordHash: await hashPassword(password, id),
    profileId: null,
  };
  save({ ...state, accounts: [...state.accounts, account], sessionAccountId: id });
  return { ok: true };
}

// ログイン（メール、または子ども用のログインID）
export async function signIn(kind: "email" | "loginId", identifier: string, password: string): Promise<Result> {
  const state = load();
  const account =
    kind === "email"
      ? state.accounts.find((a) => a.email === normalizeEmail(identifier))
      : state.accounts.find((a) => a.loginId === normalizeLoginId(identifier));
  if (!account || account.passwordHash !== (await hashPassword(password, account.id))) {
    return { ok: false, error: "invalidCredentials" };
  }
  save({ ...state, sessionAccountId: account.id });
  return { ok: true };
}

export function signOut() {
  save({ ...load(), sessionAccountId: null });
}

export type ProfileInput = Omit<Profile, "id" | "familyId" | "createdBy">;

// 自分のプロフィールを作成・更新
export function saveMyProfile(input: ProfileInput) {
  const state = load();
  const account = state.accounts.find((a) => a.id === state.sessionAccountId);
  if (!account) return;
  const existing = state.profiles.find((p) => p.id === account.profileId);
  if (existing) {
    save({ ...state, profiles: state.profiles.map((p) => (p.id === existing.id ? { ...existing, ...input } : p)) });
    return;
  }
  const profile: Profile = { id: createId("profile"), familyId: null, createdBy: null, ...input };
  save({
    ...state,
    profiles: [...state.profiles, profile],
    accounts: state.accounts.map((a) => (a.id === account.id ? { ...a, profileId: profile.id } : a)),
  });
}

function newInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見間違えやすい 0/O, 1/I は使わない
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function myProfile(state: AuthState) {
  const account = state.accounts.find((a) => a.id === state.sessionAccountId);
  return state.profiles.find((p) => p.id === account?.profileId);
}

// 家族グループを作る（最初の1人）
export function createFamily(name: string): Result {
  const state = load();
  const me = myProfile(state);
  if (!me) return { ok: false, error: "notAllowed" };
  const family: Family = { id: createId("family"), name: name.trim(), inviteCode: newInviteCode(), createdBy: me.id };
  save({
    ...state,
    families: [...state.families, family],
    profiles: state.profiles.map((p) => (p.id === me.id ? { ...p, familyId: family.id } : p)),
  });
  return { ok: true };
}

// 招待コードで家族グループに参加
export function joinFamily(code: string): Result {
  const state = load();
  const me = myProfile(state);
  const family = state.families.find((f) => f.inviteCode === code.trim().toUpperCase());
  if (!me) return { ok: false, error: "notAllowed" };
  if (!family) return { ok: false, error: "inviteNotFound" };
  save({ ...state, profiles: state.profiles.map((p) => (p.id === me.id ? { ...p, familyId: family.id } : p)) });
  return { ok: true };
}

// 親が子どものアカウントを作る（子どもは ID＋パスワードでログイン）
export async function createChildAccount(loginId: string, password: string, input: ProfileInput): Promise<Result> {
  const state = load();
  const me = myProfile(state);
  if (!me?.familyId) return { ok: false, error: "notAllowed" };
  const normalized = normalizeLoginId(loginId);
  if (state.accounts.some((a) => a.loginId === normalized)) return { ok: false, error: "loginIdTaken" };
  const profile: Profile = { id: createId("profile"), familyId: me.familyId, createdBy: me.id, ...input };
  const id = createId("account");
  const account: Account = {
    id,
    email: null,
    loginId: normalized,
    passwordHash: await hashPassword(password, id),
    profileId: profile.id,
  };
  save({ ...state, profiles: [...state.profiles, profile], accounts: [...state.accounts, account] });
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<Result> {
  const state = load();
  const account = state.accounts.find((a) => a.id === state.sessionAccountId);
  if (!account) return { ok: false, error: "notAllowed" };
  if (account.passwordHash !== (await hashPassword(current, account.id))) return { ok: false, error: "wrongPassword" };
  const passwordHash = await hashPassword(next, account.id);
  save({ ...state, accounts: state.accounts.map((a) => (a.id === account.id ? { ...a, passwordHash } : a)) });
  return { ok: true };
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
