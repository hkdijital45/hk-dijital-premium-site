import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

const DEFAULT_SCORE_THRESHOLD = 70;

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

export async function generateOutreachDrafts(triggeredBy: "cron" | "manual" = "manual", scoreThreshold = DEFAULT_SCORE_THRESHOLD) {
  const candidates = await safeFetch<Array<{ id: string; company: string | null; sector: string | null; lead_heat_score: number | null; digital_maturity_score: number | null }>>(
    `leads?status=eq.Yeni&lead_heat_score=gte.${scoreThreshold}&select=id,company,sector,lead_heat_score,digital_maturity_score&limit=50`,
    []
  );

  let created = 0;
  for (const lead of candidates) {
    const existing = await safeFetch<Array<{ id: string }>>(`outreach_drafts?lead_id=eq.${lead.id}&select=id&limit=1`, []);
    if (existing.length) continue;

    const ai = await executeAiTask({
      taskType: "customer_message",
      module: "Autonomous Lead Gen",
      endpoint: "/api/admin/outreach/run-daily",
      prompt: `"${lead.company || "İşletme"}" (${lead.sector || "sektör belirtilmedi"}) için kısa, kişiselleştirilmiş bir ilk temas mesajı taslağı yaz. HK Dijital'in dijital pazarlama ajansı olduğunu belirt, aşırı satış dili kullanma, tek bir net soru veya davet ile bitir. Max 60 kelime.`,
      expectedOutput: "Kısa ilk temas mesajı",
      fallbackText: "Merhaba, HK Dijital olarak işletmenizin dijital görünürlüğünü artırma konusunda kısa bir görüşme yapmak isteriz. Uygun olduğunuzda dönüş yapabilir misiniz?",
      createdBy: null
    }, { cacheTtlMs: 0 });

    await supabaseRest("outreach_drafts", {
      method: "POST",
      body: JSON.stringify({
        lead_id: lead.id,
        channel: "email",
        recommended_service: null,
        message_draft: ai.text,
        evidence: { leadHeatScore: lead.lead_heat_score, digitalMaturityScore: lead.digital_maturity_score },
        status: "draft"
      })
    });
    created += 1;
  }

  return { ok: true, triggeredBy, candidatesFound: candidates.length, draftsCreated: created };
}

export async function sendOutreachDraft(id: string) {
  const rows = await safeFetch<Array<{ id: string; status: string }>>(`outreach_drafts?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`, []);
  const draft = rows[0];
  if (!draft) return { ok: false, error: "Taslak bulunamadı." };
  if (draft.status !== "approved") return { ok: false, error: "Yalnızca onaylanmış taslaklar gönderilebilir." };

  const autoSendEnabled = String(process.env.AUTO_SEND_OUTREACH || "false").toLowerCase() === "true";
  if (!autoSendEnabled) {
    return { ok: false, message: "AUTO_SEND_OUTREACH kapalı — gönderim manuel yapılmalıdır. Taslak onaylı durumda bekliyor." };
  }

  // Even if enabled, no real outbound email/WhatsApp send provider is wired
  // in this codebase yet — report the capability gap, never fake a send.
  return { ok: false, message: "Gerçek bir gönderim sağlayıcısı (e-posta/WhatsApp) bu ortamda yapılandırılmadı." };
}
