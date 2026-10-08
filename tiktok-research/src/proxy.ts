// 自分専用にするためのログイン（ブラウザ標準のBasic認証）。Cookie は一切使わない。
import { NextResponse, type NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const user = process.env.APP_USER ?? "";
  const pass = process.env.APP_PASSWORD ?? "";

  if (!pass) {
    // 本番でパスワード未設定のまま公開されるのを防ぐ
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD が設定されていません。環境変数を設定してから再デプロイしてください。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep >= 0 && safeEqual(decoded.slice(0, sep), user) && safeEqual(decoded.slice(sep + 1), pass)) {
        return NextResponse.next();
      }
    } catch {
      // 形式がおかしいときは下でもう一度ログインを求める
    }
  }
  return new NextResponse("ログインが必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TikTok Research", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt).*)"],
};
