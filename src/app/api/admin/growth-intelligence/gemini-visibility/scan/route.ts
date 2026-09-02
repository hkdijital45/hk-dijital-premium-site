import { NextResponse } from "next/server";
import { requireAdmin, requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { runGeminiVisibilityScan } from "@/lib/gemini-visibility/scan";
import { getQuotaStatus } from "@/lib/gemini-visibility/quota";
import type { GeminiVisibilityProfile, GeminiVisibilityScan } from "@/lib/gemini-visibility/types";

// A full scan (several sequential Gemini calls + one batch analysis call)
// can legitimately take longer than the platform's default function
// timeout — this is a manual, admin-triggered action, not a page load.
export const maxDuration = 300;

export async function GET(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ scans: [] });

  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "profileId zorunludur." }, { status: 400 });

  try {
    const scans = await supabaseRest<GeminiVisibilityScan[]>(
      `gemini_visibility_scans?profile_id=eq.${encodeURIComponent(profileId)}&select=*&order=started_at.desc&limit=25`
    );
    return NextResponse.json({ scans });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: "Gemini API anahtarı yapılandırılmadı. Sistem yöneticinize başvurun." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = String(body.profileId || "").trim();
  const forceRefresh = Boolean(body.forceRefresh);
  if (!profileId) return NextResponse.json({ error: "profileId zorunludur." }, { status: 400 });

  // "Yeniden Zorla" (force refresh, bypassing the 7-day cache) is admin-only.
  if (forceRefresh && !(await requireAdmin())) {
    return NextResponse.json({ error: "Önbelleği zorlama yalnızca yöneticiler için kullanılabilir." }, { status: 403 });
  }

  try {
    const profiles = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(profileId)}&select=*&limit=1`);
    if (!profiles[0]) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const quota = await getQuotaStatus(profiles[0].company_id);
    if (quota.exceeded) {
      return NextResponse.json({ error: "Aylık Gemini görünürlük kotası doldu.", quota }, { status: 429 });
    }

    const scan = await runGeminiVisibilityScan(profileId, { triggeredBy: "manual", forceRefresh, createdBy: session.profileId || null });
    return NextResponse.json({ scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tarama başlatılamadı.";
    const status = message.includes("zaten bir tarama") ? 409 : message.includes("kotası doldu") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
