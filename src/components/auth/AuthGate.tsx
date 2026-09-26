"use client";

import { Users } from "lucide-react";
import { useAuth } from "@/lib/profile/authStore";
import AuthScreens from "./AuthScreens";
import { FamilySetup, ProfileSetup } from "./SetupScreens";

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
  if (auth.status === "signedOut") return <AuthScreens />;
  if (!auth.profile) return <ProfileSetup />;
  if (!auth.family) return <FamilySetup />;
  return <>{children}</>;
}
