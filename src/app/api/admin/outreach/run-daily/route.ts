import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { generateOutreachDrafts } from "@/lib/lead-outreach";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

async function authorizeManualOrCron(request: Request): Promise<"cron" | "manual" | null> {
  if (cronAuthorized(request)) return "cron";
  const session = await requireModuleAccess("leads");
  return session ? "manual" : null;
}

async function run(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    return NextResponse.json(await generateOutreachDrafts(mode));
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
