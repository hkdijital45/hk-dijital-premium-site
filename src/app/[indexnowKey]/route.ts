import { NextResponse } from "next/server";

// IndexNow requires the key to be hosted as a plain-text file at the domain
// root: https://<host>/<key>.txt. This is the only thing this catch-all
// segment does — every other path still falls through to Next's normal
// not-found handling, since static route segments (e.g. /blog, /hizmetler)
// always take precedence over a dynamic one at the same level.
export async function GET(_request: Request, context: { params: Promise<{ indexnowKey: string }> }) {
  const { indexnowKey } = await context.params;
  const key = String(process.env.INDEXNOW_KEY || "").trim();

  if (!key || indexnowKey !== `${key}.txt`) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(key, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
