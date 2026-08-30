import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { generateConversationInsight } from "@/lib/communication-ai";

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ insight: null });

  const conversationId = new URL(request.url).searchParams.get("conversationId") || "";
  if (!conversationId) return NextResponse.json({ error: "conversationId zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(
      `communication_ai_insights?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=generated_at.desc&limit=1`
    );
    return NextResponse.json({ insight: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const conversationId = String(body.conversationId || "");
  if (!conversationId) return NextResponse.json({ error: "conversationId zorunludur." }, { status: 400 });

  try {
    const insight = await generateConversationInsight(conversationId);
    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Özet oluşturulamadı." }, { status: 500 });
  }
}
