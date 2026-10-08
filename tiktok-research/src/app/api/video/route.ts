// GET /api/video?url=動画URL（短縮URLも可） → 動画1本の情報
import { failure, json } from "@/lib/http";
import { parseInput } from "@/lib/parse";
import { getVideoDetail } from "@/lib/tikwm";

export async function GET(request: Request) {
  const parsed = parseInput(new URL(request.url).searchParams.get("url") ?? "");
  if (parsed.kind !== "video") return json({ error: "TikTokの動画URLを入力してください" }, 400);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { media, images, cookie, ...video } = await getVideoDetail(parsed.url);
    // 配信元URLは返さない（ダウンロードは必ず /api/download を通す）
    return json({ ...video, available: Object.keys(media), images: images.length });
  } catch (e) {
    return failure(e);
  }
}
