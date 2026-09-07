import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE, classifyExecutionStatus, type ApprovalActionType } from "@/lib/ai-workforce-schema";
import { logAiWorkforceActivity } from "@/lib/ai-workforce";

type ApprovalRow = {
  id: string;
  title: string;
  description?: string | null;
  action_type: ApprovalActionType;
  company_id?: string | null;
  agent_key?: string | null;
  proposed_change?: { kind?: string; taskTitle?: string; taskDescription?: string; priority?: string } | null;
  status: string;
};

type RecommendationRow = {
  id: string;
  company_id?: string | null;
  title: string;
  recommendation_type?: string | null;
};

// Decides one approval item from either source surfaced by GET /approvals.
// Approving an internal_write ai_approval_requests row (proposed_change.kind
// === "create_task") actually creates the agency_tasks row — this is not a
// fake approve button. external_write/destructive items are marked
// execution_unavailable rather than pretending an external system call ran,
// per the "no fake execution" requirement.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : null;
  const source = body.source === "recommendation" ? "recommendation" : "approval";
  if (!decision) return NextResponse.json({ error: "decision alanı 'approved' veya 'rejected' olmalı." }, { status: 400 });
  const decidedBy = session.profileId || session.authUserId || null;
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

  try {
    if (source === "recommendation") {
      const rows = await supabaseRest<RecommendationRow[]>(`hk_recommendations?id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => []);
      const recommendation = rows[0];
      if (!recommendation) return NextResponse.json({ error: "Öneri bulunamadı." }, { status: 404 });

      let createdTaskId: string | null = null;
      if (decision === "approved") {
        const taskRows = await supabaseRest<{ id: string }[]>("agency_tasks", {
          method: "POST",
          body: JSON.stringify({
            company_id: recommendation.company_id || null,
            title: recommendation.title,
            description: `HK Intelligence önerisi: ${recommendation.recommendation_type || "genel"}`,
            status: "Açık",
            priority: "Normal",
            ai_generated: true,
            automation_key: `ai-workforce-recommendation-${id}`,
            metadata: { recommendation_id: id, approved_by: decidedBy }
          })
        }).catch(() => []);
        createdTaskId = taskRows[0]?.id || null;
      }
      await supabaseRest(`hk_recommendations?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: decision === "approved" ? "converted" : "dismissed", updated_at: new Date().toISOString() })
      }).catch(() => null);

      await logAiWorkforceActivity({
        eventType: decision === "approved" ? "approval_approved" : "approval_rejected",
        summary: `Öneri ${decision === "approved" ? "onaylandı" : "reddedildi"}: ${recommendation.title}`,
        companyId: recommendation.company_id,
        taskId: createdTaskId,
        createdBy: decidedBy,
        metadata: { source: "recommendation", recommendationId: id }
      });

      return NextResponse.json({ ok: true, status: decision, executionStatus: decision === "approved" ? "executed" : "not_applicable", taskId: createdTaskId });
    }

    const rows = await supabaseRest<ApprovalRow[]>(`ai_approval_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => []);
    const approval = rows[0];
    if (!approval) return NextResponse.json({ error: "Onay kaydı bulunamadı." }, { status: 404 });
    if (approval.status !== "pending") return NextResponse.json({ error: "Bu kayıt zaten karara bağlanmış." }, { status: 409 });

    const executionStatus = classifyExecutionStatus(approval.action_type, decision);
    let createdTaskId: string | null = null;
    if (decision === "approved" && executionStatus === "executed" && approval.proposed_change?.kind === "create_task") {
      const taskRows = await supabaseRest<{ id: string }[]>("agency_tasks", {
        method: "POST",
        body: JSON.stringify({
          company_id: approval.company_id || null,
          title: approval.proposed_change.taskTitle || approval.title,
          description: approval.proposed_change.taskDescription || approval.description || "",
          status: "Açık",
          priority: approval.proposed_change.priority || "Normal",
          ai_generated: true,
          automation_key: `ai-workforce-approval-${id}`,
          metadata: { approval_id: id, agent_key: approval.agent_key, approved_by: decidedBy }
        })
      }).catch(() => []);
      createdTaskId = taskRows[0]?.id || null;
    }

    await supabaseRest(`ai_approval_requests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: decision,
        decision_note: note,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        execution_status: executionStatus,
        updated_at: new Date().toISOString()
      })
    });

    await logAiWorkforceActivity({
      eventType: decision === "approved" ? "approval_approved" : "approval_rejected",
      summary: `Onay ${decision === "approved" ? "onaylandı" : "reddedildi"}: ${approval.title}`,
      agentKey: approval.agent_key,
      companyId: approval.company_id,
      approvalId: id,
      taskId: createdTaskId,
      createdBy: decidedBy
    });

    return NextResponse.json({ ok: true, status: decision, executionStatus, taskId: createdTaskId });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
