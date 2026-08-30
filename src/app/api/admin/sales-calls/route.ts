import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { analyzeSalesCall } from "@/lib/sales-call-analysis";

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ calls: [] });

  const recordType = new URL(request.url).searchParams.get("recordType");
  const filters = ["select=id,title,record_type,company_id,summary,sentiment,closing_probability,occurred_at,action_items", "order=occurred_at.desc", "limit=100"];
  if (recordType) filters.push(`record_type=eq.${recordType}`);

  try {
    const calls = await supabaseRest<Array<Record<string, unknown>>>(`sales_call_analyses?${filters.join("&")}`);
    return NextResponse.json({ calls });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title || "").trim();
  const rawTranscript = String(body.rawTranscript || "").trim();
  const recordType = body.recordType === "meeting" ? "meeting" : "sales_call";
  if (!title || rawTranscript.length < 20) return NextResponse.json({ error: "Başlık ve en az 20 karakterlik döküm gerekli." }, { status: 400 });

  try {
    const call = await analyzeSalesCall({
      title,
      rawTranscript,
      leadId: body.leadId ? String(body.leadId) : null,
      companyId: body.companyId ? String(body.companyId) : null,
      recordType,
      createdBy: session.profileId || null
    });
    return NextResponse.json({ call });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analiz oluşturulamadı." }, { status: 500 });
  }
}
