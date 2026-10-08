import "server-only";
import { UpstreamError } from "./tikwm";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function failure(e: unknown) {
  if (e instanceof UpstreamError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: "予期しないエラーが起きました" }, 500);
}
