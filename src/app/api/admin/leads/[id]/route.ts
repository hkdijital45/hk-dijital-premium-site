/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

async function requireCrmAccess() {
  return await requireModuleAccess("crm") || requireModuleAccess("leads");
}

const editableFields = [
  "source",
  "company_id",
  "name",
  "company",
  "phone",
  "email",
  "instagram",
  "website",
  "business_type",
  "goal",
  "budget",
  "recommended_package",
  "message",
  "status",
  "pipeline_stage",
  "notes",
  "follow_up_date",
  "last_contact_at",
  "next_action_at",
  "next_action",
  "city",
  "district",
  "sector",
  "address",
  "source_url",
  "proposal_status",
  "proposal_amount",
  "estimated_close_date",
  "last_whatsapp_at",
  "meeting_at",
  "proposal_sent_at",
  "calendar_follow_up_at",
  "deleted_at",
  "rejected_at",
  "rejection_reason"
];

function sanitizeLeadPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field] === "" ? null : body[field];
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) patch.status = body.status || "Yeni Başvuru";
  patch.updated_at = new Date().toISOString();
  return patch;
}

const stageTaskRules: Record<string, { title: string; delay: number; priority: string }> = {
  "Teklif Gönderildi": { title: "Teklif dönüşü takibi", delay: 3, priority: "Yüksek" },
  "Takipte": { title: "Son karar için takip araması", delay: 2, priority: "Yüksek" },
  "Kaybedildi": { title: "Kayıp nedeni değerlendirmesi", delay: 0, priority: "Normal" }
};

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function createStageTasks(lead: any, stage: string) {
  const rules = stage === "Kazanıldı"
    ? [
      { title: "Sözleşme ve teklif kontrolü", delay: 0, priority: "Yüksek" },
      { title: "Reklam hesap erişimleri", delay: 1, priority: "Yüksek" },
      { title: "Meta Pixel kontrolü", delay: 2, priority: "Yüksek" },
      { title: "İlk rapor tarihi planı", delay: 7, priority: "Normal" }
    ]
    : stageTaskRules[stage] ? [stageTaskRules[stage]] : [];

  for (const rule of rules) {
    const dueDate = dateAfter(rule.delay);
    const automationKey = stage === "Kazanıldı"
      ? `lead:${lead.id}:onboarding:${rule.title}`
      : `lead:${lead.id}:${stage}:${rule.title}:${dueDate}`;
    await supabaseRest("agency_tasks?on_conflict=automation_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        company_id: lead.company_id || null,
        lead_id: lead.id,
        automation_key: automationKey,
        title: `${lead.company || lead.name || "Lead"} · ${rule.title}`,
        description: `${stage} aşaması için otomatik oluşturuldu.`,
        notes: `${stage} aşaması için otomatik oluşturuldu.`,
        status: "Yapılacak",
        priority: rule.priority,
        due_date: dueDate,
        visible_to_customer: false,
        updated_at: new Date().toISOString()
      })
    });
  }
}

async function createCalendarTasks(lead: any, patch: Record<string, unknown>) {
  const items = [
    { field: "meeting_at", title: "Lead toplantısı" },
    { field: "calendar_follow_up_at", title: "Lead takip görüşmesi" },
    { field: "proposal_sent_at", title: "Teklif gönderimi" }
  ];
  for (const item of items) {
    const rawDate = patch[item.field];
    if (!rawDate) continue;
    const dueDate = String(rawDate).slice(0, 10);
    await supabaseRest("agency_tasks?on_conflict=automation_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        company_id: lead.company_id || null,
        lead_id: lead.id,
        automation_key: `lead:${lead.id}:calendar:${item.field}:${dueDate}`,
        title: `${lead.company || lead.name || "Lead"} · ${item.title}`,
        description: "Satış Hunisi takvim planından oluşturuldu.",
        notes: "Satış Hunisi takvim planından oluşturuldu.",
        status: "Yapılacak",
        priority: "Normal",
        due_date: dueDate,
        visible_to_customer: false,
        updated_at: new Date().toISOString()
      })
    });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const patch = sanitizeLeadPatch(body);
  let compatibilityWarning = "";
  const automationWarnings: string[] = [];

  try {
    const existingRows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (!existingRows[0]) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    let rows: any[];
    try {
      rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      if (!message.includes("PGRST204") || !message.includes("calendar_follow_up_at")) throw writeError;
      compatibilityWarning = "calendar_follow_up_at canlı şemada bulunamadı. Takip tarihi next_action_at alanına kaydedildi; schema repair migration uygulanmalıdır.";
      const compatiblePatch = { ...patch };
      delete compatiblePatch.calendar_follow_up_at;
      rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(compatiblePatch)
      });
    }
    if (!rows[0]) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    const requestedStage = String(patch.pipeline_stage || patch.status || "");
    const previousStage = String(existingRows[0].pipeline_stage || existingRows[0].status || "");
    if (requestedStage && requestedStage !== previousStage) {
      await createStageTasks(rows[0], requestedStage).catch((taskError) => {
        const detail = taskError instanceof Error ? taskError.message : String(taskError);
        automationWarnings.push(`Otomatik görev oluşturulamadı: ${detail}`);
      });
    }
    if (patch.meeting_at || patch.calendar_follow_up_at || patch.proposal_sent_at) {
      await createCalendarTasks(rows[0], patch).catch((taskError) => {
        const detail = taskError instanceof Error ? taskError.message : String(taskError);
        automationWarnings.push(`Takvim görevi oluşturulamadı: ${detail}`);
      });
    }
    const warning = [compatibilityWarning, ...automationWarnings].filter(Boolean).join(" ");
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Başvuru",
      entityId: id,
      companyId: rows[0].company_id,
      details: { message: "CRM başvurusu güncellendi", fields: Object.keys(patch).filter((key) => key !== "updated_at"), result: warning ? "Uyarı" : "Başarılı", warning: warning || undefined }
    });
    if (warning) {
      await recordActivity({ session, action: "API İşlemi", entity: "Satış Hunisi Otomasyonu", entityId: id, companyId: rows[0].company_id, details: { message: warning, result: "Uyarı", warning } });
    }
    return NextResponse.json({ ok: true, lead: rows[0], message: "Başvuru güncellendi.", warning: warning || undefined });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[crm-lead] Başvuru güncelleme hatası", safe.detail);
    await recordActionFailure({ session, entity: "Satış Hunisi", action: "Lead güncelleme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  try {
    const rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
    await recordActivity({
      session,
      action: "Arşivleme",
      entity: "Başvuru",
      entityId: id,
      companyId: rows?.[0]?.company_id,
      details: { message: "CRM başvurusu güvenli şekilde arşivlendi" }
    });
    return NextResponse.json({ ok: true, lead: rows?.[0] || null, message: "Başvuru arşivlendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Satış Hunisi", action: "Lead arşivleme", error, entityId: id }).catch(() => null);
    console.error("[crm-lead] Başvuru arşivleme hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
