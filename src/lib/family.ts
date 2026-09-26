"use client";

// 登録した本物の家族（マイページのプロフィール）を、アプリ全体で使う形にする
import { useMemo } from "react";
import { useAuth } from "@/lib/profile/authStore";
import { displayNameOf, roleOf, type Profile, type Relation, type Role } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/useI18n";

export type Member = {
  id: string;
  name: string; // アプリ内での呼び名（表示名 → パパ など → 名前）
  fullName: string;
  photo: string | null;
  color: Profile["color"];
  relation: Relation;
  role: Role;
  shareLocation: boolean;
};

const UNKNOWN: Member = {
  id: "unknown",
  name: "?",
  fullName: "?",
  photo: null,
  color: "bg-slate-400" as Profile["color"],
  relation: "other",
  role: "relative",
  shareLocation: false,
};

// ログイン済み・家族参加済みの画面（AuthGate の内側）で使います
export function useFamily() {
  const auth = useAuth();
  const { lang } = useI18n();
  return useMemo(() => {
    if (auth.status !== "signedIn" || !auth.profile || !auth.family) {
      return { ready: false as const };
    }
    const toMember = (p: Profile): Member => ({
      id: p.id,
      name: displayNameOf(p, lang),
      fullName: p.name,
      photo: p.photo,
      color: p.color,
      relation: p.relation,
      role: roleOf(p.relation),
      shareLocation: p.shareLocation,
    });
    const members = auth.members.map(toMember);
    const me = members.find((m) => m.id === auth.profile!.id) ?? toMember(auth.profile);
    return {
      ready: true as const,
      family: auth.family,
      me,
      members,
      others: members.filter((m) => m.id !== me.id),
      member: (id: string) => members.find((m) => m.id === id) ?? UNKNOWN,
    };
  }, [auth, lang]);
}
