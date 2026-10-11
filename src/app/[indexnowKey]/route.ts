import { NextResponse } from "next/server";
import { BRANDED_NOT_FOUND_HTML } from "@/lib/branded-not-found-html";

// IndexNow requires the key to be hosted as a plain-text file at the domain
// root: https://<host>/<key>.txt. Any OTHER single-segment path also
// matches this same dynamic route (e.g. /some-random-slug) — Route
// Handlers can't defer to the App Router's own not-found.tsx/
// global-not-found.tsx rendering (notFound() only works inside a
// Server Component render, not a route handler), so the real 404 content
// is inlined here too (see branded-not-found-html.ts — the one other
// place this exact markup lives is app/global-not-found.tsx, for a
// genuinely unmatched multi-segment URL). Found via direct testing: this
// route was shadowing EVERY single-segment unmatched URL with a bare
// "Not Found" string instead of the branded 404 page.
export async function GET(_request: Request, context: { params: Promise<{ indexnowKey: string }> }) {
  const { indexnowKey } = await context.params;
  const key = String(process.env.INDEXNOW_KEY || "").trim();

  if (!key || indexnowKey !== `${key}.txt`) {
    return new NextResponse(BRANDED_NOT_FOUND_HTML, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return new NextResponse(key, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
