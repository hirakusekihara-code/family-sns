// GET /api/download?id=動画ID&author=ユーザー名&kind=hd|sd|wm|music|image&i=画像番号
//   → ファイルを中継して保存させる（inline=1 ならその場で再生）
import { failure, json } from "@/lib/http";
import { isValidUsername, isValidVideoId, safeFilename } from "@/lib/parse";
import { MOCK, assertMediaUrl, fetchMedia, getVideoDetail, videoPageUrl } from "@/lib/tikwm";
import type { MediaKind } from "@/lib/types";

const KINDS: MediaKind[] = ["hd", "sd", "wm", "music", "image"];

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const id = p.get("id") ?? "";
  const author = (p.get("author") ?? "").replace(/^@/, "");
  const kind = (p.get("kind") ?? "hd") as MediaKind;
  const index = Number(p.get("i") ?? "0");
  const inline = p.get("inline") === "1";
  if (!isValidVideoId(id)) return json({ error: "動画IDが正しくありません" }, 400);
  if (author && !isValidUsername(author)) return json({ error: "ユーザー名が正しくありません" }, 400);
  if (!KINDS.includes(kind) || !Number.isInteger(index) || index < 0 || index > 99) {
    return json({ error: "種類の指定が正しくありません" }, 400);
  }

  if (MOCK) {
    // サンプルモードではダミーのファイルを返す（保存の流れを確認するため）
    const body = new Uint8Array(256 * 1024).fill(0x2e);
    return new Response(body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(body.length),
        "Content-Disposition": `attachment; filename="${author || "sample"}_${id}_${kind}.mock"`,
      },
    });
  }

  try {
    const detail = await getVideoDetail(videoPageUrl(id, author));
    let source = "";
    let ext = "mp4";
    if (kind === "image") {
      source = detail.images[index] ?? "";
      ext = /\.png(\?|$)/i.test(source) ? "png" : /\.webp(\?|$)/i.test(source) ? "webp" : "jpg";
    } else if (kind === "music") {
      source = detail.media.music ?? "";
      ext = "mp3";
    } else {
      // HD が無い動画は通常画質にフォールバック
      source = detail.media[kind] ?? (kind === "hd" ? detail.media.sd ?? "" : "");
    }
    if (!source) return json({ error: "この投稿ではその形式は取得できません" }, 404);
    const target = assertMediaUrl(source);

    const upstream = await fetchMedia(target, request.headers.get("range"), detail.cookie);
    const suffix = kind === "image" ? `_${index + 1}` : kind === "wm" ? "_wm" : kind === "music" ? "_audio" : "";
    const filename = safeFilename(`${detail.author || author || "tiktok"}_${id}${suffix}`) + `.${ext}`;
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? (ext === "mp3" ? "audio/mpeg" : ext === "mp4" ? "video/mp4" : `image/${ext}`),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
    });
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (e) {
    return failure(e);
  }
}
