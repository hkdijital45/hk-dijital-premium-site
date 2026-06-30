/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedFields = ["show_to_customer", "action_status", "resolved_at", "customer_visible_summary", "agency_action"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip sinyali güncellemek için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, any> = {};
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
  });
  if (body.resolve) {
    patch.action_status = "resolved";
    patch.resolved_at = new Date().toISOString();
    const actor = session as any;
    patch.resolved_by = actor.userId || actor.id || actor.user_id || null;
  }
  try {
    const rows = await supabaseRest<any[]>(`competitor_signals?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    const signal = rows[0] || { id, ...patch };
    return NextResponse.json(buildActionResult({
      title: "Rakip sinyali güncellendi",
      summary: "Sinyal görünürlüğü veya çözüm durumu güncellendi.",
      entityType: "Rakip Sinyali",
      entityId: id,
      companyId: signal.company_id,
      status: "success",
      createdRecords: [{ label: "Rakip sinyali", count: 1, status: patch.resolved_at ? "Çözüldü" : "Güncellendi" }],
      nextActions: ["Yeni sinyaller panelini kontrol et.", "Gerekirse müşteriye sade özet hazırla."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: Boolean(signal.show_to_customer ?? patch.show_to_customer), label: signal.show_to_customer || patch.show_to_customer ? "Sinyal müşteriye açık." : "Sinyal sadece admin tarafında görünüyor." },
      technicalDetails: { signalId: id, patch }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Rakip sinyali güncellenemedi", summary: safe.detail, status: "error", nextActions: ["competitor_signals migration durumunu kontrol et.", "Tekrar dene."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
