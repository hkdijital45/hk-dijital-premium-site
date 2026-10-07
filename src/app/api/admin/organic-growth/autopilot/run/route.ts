import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { runOrganicGrowthAutopilot } from "@/lib/organic-growth/autopilot";

// Same dual cron/manual authorization convention as
// /api/admin/seo-autopilot/run-daily — a Vercel Cron request authenticates
// with CRON_SECRET (Authorization: Bearer), an admin click authenticates
// with the normal session + blog-seo module access.
function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

async function authorize(request: Request): Promise<{ mode: "cron" | "manual"; email: string | null } | null> {
  if (cronAuthorized(request)) return { mode: "cron", email: null };
  const session = await requireModuleAccess("blog-seo");
  return session ? { mode: "manual", email: session.email || null } : null;
}

async function run(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const outcome = await runOrganicGrowthAutopilot(auth.mode, auth.email);
    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json({ status: "failed", step: "route", error: error instanceof Error ? error.message : "Bilinmeyen hata" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
