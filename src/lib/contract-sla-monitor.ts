import "server-only";
import { supabaseRest } from "@/lib/supabase";

const RENEWAL_WINDOW_DAYS = 30;

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function ensureRenewalOpportunity(companyId: string, contractId: string) {
  const existing = await safeFetch<Array<{ id: string }>>(
    `upsell_opportunities?company_id=eq.${companyId}&trigger_type=eq.contract_renewal&status=in.(new,approved)&select=id&limit=1`,
    []
  );
  if (existing.length) return;

  await supabaseRest("upsell_opportunities", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      trigger_type: "contract_renewal",
      recommended_service: "Sözleşme Yenileme",
      estimated_value: 0,
      probability: 60,
      evidence: { contractId },
      ai_pitch: "Sözleşme süresi 30 gün içinde doluyor. Yenileme teklifi hazırlanmalı.",
      status: "new"
    })
  }).catch(() => null);
}

// Only report_delivery SLAs are auto-monitored today (checked against the
// real `reports` table). Other SLA types (response_time, optimization
// frequency, custom) are schema-supported but need a real event source per
// type before automated breach detection is honest — not implemented yet.
async function checkReportDeliverySla(definition: { id: string; contract_id: string; target_value: string }, companyId: string) {
  const targetDays = Number(definition.target_value) || 30;
  const recentReports = await safeFetch<Array<{ id: string }>>(
    `reports?company_id=eq.${companyId}&created_at=gte.${new Date(Date.now() - targetDays * 86_400_000).toISOString()}&select=id&limit=1`,
    []
  );
  if (recentReports.length) return;

  const recentBreach = await safeFetch<Array<{ id: string }>>(
    `sla_events?sla_definition_id=eq.${definition.id}&event_type=eq.breach&detected_at=gte.${new Date(Date.now() - targetDays * 86_400_000).toISOString()}&select=id&limit=1`,
    []
  );
  if (recentBreach.length) return;

  const task = await supabaseRest<Array<{ id: string }>>("agency_tasks", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      title: "SLA ihlali: rapor teslim süresi",
      description: `${targetDays} günlük rapor teslim SLA'sı aşıldı.`,
      status: "Yapılacak",
      priority: "Yüksek",
      due_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      automation_key: `sla-breach-${definition.id}-${Date.now()}`
    })
  });

  await supabaseRest("sla_events", {
    method: "POST",
    body: JSON.stringify({
      sla_definition_id: definition.id,
      event_type: "breach",
      detail: `Son ${targetDays} gün içinde yeni rapor oluşturulmadı.`,
      task_id: task[0]?.id || null
    })
  });
}

export async function runContractSlaMonitor(triggeredBy: "cron" | "manual" = "manual") {
  const windowEnd = new Date(Date.now() + RENEWAL_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const expiringContracts = await safeFetch<Array<{ id: string; company_id: string; end_date: string }>>(
    `contracts?status=eq.active&end_date=lte.${windowEnd}&end_date=gte.${today}&select=id,company_id,end_date&limit=200`,
    []
  );

  let renewalsQueued = 0;
  for (const contract of expiringContracts) {
    await supabaseRest(`contracts?id=eq.${contract.id}`, { method: "PATCH", body: JSON.stringify({ status: "expiring" }) }).catch(() => null);
    await ensureRenewalOpportunity(contract.company_id, contract.id);
    renewalsQueued += 1;
  }

  const expiredContracts = await safeFetch<Array<{ id: string }>>(`contracts?status=eq.active&end_date=lt.${today}&select=id&limit=200`, []);
  for (const contract of expiredContracts) {
    await supabaseRest(`contracts?id=eq.${contract.id}`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) }).catch(() => null);
  }

  const slaDefinitions = await safeFetch<Array<{ id: string; contract_id: string; sla_type: string; target_value: string; contracts: { company_id: string } }>>(
    "sla_definitions?is_active=eq.true&select=id,contract_id,sla_type,target_value,contracts(company_id)&limit=200",
    []
  );
  let slaChecked = 0;
  for (const definition of slaDefinitions) {
    if (definition.sla_type === "report_delivery" && definition.contracts?.company_id) {
      await checkReportDeliverySla(definition, definition.contracts.company_id);
      slaChecked += 1;
    }
  }

  return { ok: true, triggeredBy, renewalsQueued, expiredCount: expiredContracts.length, slaDefinitionsChecked: slaChecked };
}
