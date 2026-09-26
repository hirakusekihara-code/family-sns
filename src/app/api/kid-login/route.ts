// 子どものアカウントのログイン（ログインID → アカウントを探してログイン）
import { adminClient, publicClient } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "serverNotConfigured" }, 500);

  const body = (await request.json().catch(() => ({}))) as { loginId?: string; password?: string };
  const loginId = String(body.loginId ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!loginId || !password) return json({ error: "invalidCredentials" }, 401);

  const { data: profile } = await admin.from("profiles").select("id").eq("login_id", loginId).maybeSingle();
  if (!profile) return json({ error: "invalidCredentials" }, 401);

  const { data: userData } = await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (!email) return json({ error: "invalidCredentials" }, 401);

  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const limited = error?.status === 429;
    return json({ error: limited ? "rateLimited" : "invalidCredentials" }, limited ? 429 : 401);
  }

  // ブラウザ側で setSession するためのトークンだけを返す
  return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
}
