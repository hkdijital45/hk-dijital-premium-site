import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const hexColor = /^#[0-9a-fA-F]{6}$/;
const availableModules = ["dashboard", "reports", "communication", "documents", "tasks", "billing"];

export async function GET(_request: Request, context: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ config: null });

  const { companyId } = await context.params;
  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(`portal_configs?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`);
    return NextResponse.json({ config: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { companyId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const primaryColor = body.primaryColor ? String(body.primaryColor) : null;
  const secondaryColor = body.secondaryColor ? String(body.secondaryColor) : null;
  if (primaryColor && !hexColor.test(primaryColor)) return NextResponse.json({ error: "primaryColor geçerli bir hex renk olmalı (#RRGGBB)." }, { status: 400 });
  if (secondaryColor && !hexColor.test(secondaryColor)) return NextResponse.json({ error: "secondaryColor geçerli bir hex renk olmalı (#RRGGBB)." }, { status: 400 });

  const enabledModules = Array.isArray(body.enabledModules)
    ? body.enabledModules.map((item) => String(item)).filter((item) => availableModules.includes(item))
    : [];

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`portal_configs?on_conflict=company_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        company_id: companyId,
        logo_url: body.logoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        enabled_modules: enabledModules,
        subdomain: body.subdomain || null,
        status: body.status === "active" ? "active" : "draft"
      })
    });
    return NextResponse.json({ config: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
