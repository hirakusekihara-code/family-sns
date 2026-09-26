// 保護者が子どものアカウントを作る（サーバーで Secret key を使って作成）
import { adminClient, kidEmail } from "@/lib/supabase/admin";
import { themeColors } from "@/lib/profile/types";

const json = (body: unknown, status = 200) => Response.json(body, { status });

type Body = {
  loginId?: string;
  password?: string;
  profile?: {
    relation?: string;
    relation_note?: string;
    name?: string;
    display_name?: string;
    photo?: string | null;
    phone?: string;
    birthday?: string | null;
    color?: string;
    share_location?: boolean;
  };
};

export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "serverNotConfigured" }, 500);

  // 1. 操作している人が本当にログイン中の保護者か確認
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const parentUser = userData.user;
  if (!parentUser?.email) return json({ error: "notAllowed" }, 401);

  const { data: parent } = await admin
    .from("profiles")
    .select("id, relation, family_id")
    .eq("id", parentUser.id)
    .maybeSingle();
  if (!parent?.family_id || !["father", "mother"].includes(parent.relation)) return json({ error: "notAllowed" }, 403);

  // 2. 入力内容のチェック
  const body = (await request.json().catch(() => ({}))) as Body;
  const loginId = String(body.loginId ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const p = body.profile ?? {};
  const name = String(p.name ?? "").trim();
  if (!/^[a-z0-9_]{3,20}$/.test(loginId) || password.length < 8 || !name || !["son", "daughter"].includes(String(p.relation))) {
    return json({ error: "unknown", detail: "invalid input" }, 400);
  }

  const { data: taken } = await admin.from("profiles").select("id").eq("login_id", loginId).maybeSingle();
  if (taken) return json({ error: "loginIdTaken" }, 409);

  // 3. アカウント作成（メールは保護者のアドレス＋ログインID。確認メールは送らない）
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: kidEmail(parentUser.email, loginId),
    password,
    email_confirm: true,
    user_metadata: { kid: true, login_id: loginId },
  });
  if (createError || !created.user) {
    const exists = /already/i.test(createError?.message ?? "");
    return json({ error: exists ? "loginIdTaken" : "unknown", detail: createError?.message }, exists ? 409 : 500);
  }

  // 4. プロフィール作成（保護者と同じ家族に入れる）
  const { error: insertError } = await admin.from("profiles").insert({
    id: created.user.id,
    family_id: parent.family_id,
    relation: p.relation,
    relation_note: String(p.relation_note ?? "").slice(0, 50),
    name: name.slice(0, 50),
    display_name: String(p.display_name ?? "").trim().slice(0, 30),
    photo: typeof p.photo === "string" && p.photo.startsWith("data:image/") ? p.photo : null,
    phone: String(p.phone ?? "").slice(0, 30),
    birthday: p.birthday || null,
    color: (themeColors as readonly string[]).includes(String(p.color)) ? p.color : themeColors[0],
    share_location: p.share_location !== false,
    login_id: loginId,
    created_by: parent.id,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id); // 途中で失敗したら、作ったアカウントを消す
    return json({ error: "unknown", detail: insertError.message }, 500);
  }

  return json({ ok: true });
}
