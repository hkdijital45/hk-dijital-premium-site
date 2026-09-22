import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { DISCOVERY_WORKFLOW_STATUS, DISCOVERY_REJECTION_REASONS, isValidDiscoveryWorkflowTransition } from "@/lib/discovery-workflow";

async function requireCrmAccess() {
  return await requireModuleAccess("crm") || requireModuleAccess("leads") || requireModuleAccess("musteri-bulucu");
}

// Değerlendirme Havuzu / Potansiyel Müşteriler "Toplu Onayla" / "Toplu
// Reddet" — a single server-side batch write instead of one request per
// selected row (see Müşteri Avı Final Workflow §9). Only ever targets the
// two workflow-gated statuses this file's discovery-workflow.ts guards;
// anything else is rejected rather than silently becoming a generic
// bulk-status endpoint.
const BATCHABLE_STATUSES: string[] = [DISCOVERY_WORKFLOW_STATUS.POTENTIAL, DISCOVERY_WORKFLOW_STATUS.REJECTED];

export async function POST(request: Request) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string" && id))] as string[] : [];
  const status = typeof body.status === "string" ? body.status : "";
  const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason : "";

  if (!ids.length) return NextResponse.json({ error: "En az bir kayıt seçin." }, { status: 400 });
  if (!BATCHABLE_STATUSES.includes(status)) return NextResponse.json({ error: "Geçersiz toplu durum." }, { status: 400 });
  if (status === DISCOVERY_WORKFLOW_STATUS.REJECTED && rejectionReason && !DISCOVERY_REJECTION_REASONS.includes(rejectionReason as never)) {
    return NextResponse.json({ error: "Geçerli bir red sebebi seçin." }, { status: 400 });
  }

  try {
    const existing = await supabaseRest<Array<{ id: string; status: string | null }>>(
      `leads?select=id,status&id=in.(${ids.map(encodeURIComponent).join(",")})&deleted_at=is.null`
    );
    const eligibleIds = existing.filter((row) => isValidDiscoveryWorkflowTransition(status, row.status)).map((row) => row.id);
    const skippedIds = ids.filter((id) => !eligibleIds.includes(id));

    if (!eligibleIds.length) {
      return NextResponse.json({ ok: true, updatedCount: 0, skippedIds, leads: [] });
    }

    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === DISCOVERY_WORKFLOW_STATUS.REJECTED) {
      patch.rejected_at = new Date().toISOString();
      if (rejectionReason) patch.rejection_reason = rejectionReason;
    }

    const updated = await supabaseRest<any[]>(`leads?id=in.(${eligibleIds.map(encodeURIComponent).join(",")})`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });

    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Değerlendirme Havuzu",
      details: { message: `${updated.length} kayıt toplu olarak "${status}" durumuna taşındı.`, updatedCount: updated.length, skippedCount: skippedIds.length }
    }).catch(() => {});

    return NextResponse.json({ ok: true, updatedCount: updated.length, skippedIds, leads: updated });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[leads/batch-status] Toplu güncelleme hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
