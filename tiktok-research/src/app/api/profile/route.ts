// GET /api/profile?u=ユーザー名 → 公開プロフィール
import { failure, json } from "@/lib/http";
import { isValidUsername } from "@/lib/parse";
import { getProfile } from "@/lib/tikwm";

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u")?.trim().replace(/^@/, "") ?? "";
  if (!isValidUsername(u)) return json({ error: "ユーザー名が正しくありません" }, 400);
  try {
    return json(await getProfile(u));
  } catch (e) {
    return failure(e);
  }
}
