// GET /api/videos?u=ユーザー名&cursor=続き → 動画一覧（30件ずつ）
import { failure, json } from "@/lib/http";
import { isValidUsername } from "@/lib/parse";
import { getVideos } from "@/lib/tikwm";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const u = params.get("u")?.trim().replace(/^@/, "") ?? "";
  const cursor = params.get("cursor") ?? "0";
  if (!isValidUsername(u)) return json({ error: "ユーザー名が正しくありません" }, 400);
  if (!/^\d{0,20}$/.test(cursor)) return json({ error: "cursor が正しくありません" }, 400);
  try {
    return json(await getVideos(u, cursor));
  } catch (e) {
    return failure(e);
  }
}
