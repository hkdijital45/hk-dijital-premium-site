import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

type ParsedCallAnalysis = {
  summary: string;
  decisions: string[];
  actionItems: string[];
  objections: string[];
  sentiment: string;
  closingProbability: number;
  coachingFeedback: string;
  nextSteps: string;
};

function section(text: string, label: string, nextLabels: string[]) {
  const stopPattern = nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?:${stopPattern}:|$)`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function toList(block: string) {
  return block.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 8);
}

const LABELS = ["ÖZET", "KARARLAR", "AKSİYONLAR", "İTİRAZLAR", "DUYGU", "KAPANIŞ OLASILIĞI", "KOÇLUK NOTU", "SONRAKI ADIMLAR"];

function parseCallAnalysis(text: string): ParsedCallAnalysis {
  const rest = (label: string) => LABELS.slice(LABELS.indexOf(label) + 1);
  const closingText = section(text, "KAPANIŞ OLASILIĞI", rest("KAPANIŞ OLASILIĞI"));
  const closingMatch = closingText.match(/\d+/);

  return {
    summary: section(text, "ÖZET", rest("ÖZET")) || text.slice(0, 240),
    decisions: toList(section(text, "KARARLAR", rest("KARARLAR"))),
    actionItems: toList(section(text, "AKSİYONLAR", rest("AKSİYONLAR"))),
    objections: toList(section(text, "İTİRAZLAR", rest("İTİRAZLAR"))),
    sentiment: section(text, "DUYGU", rest("DUYGU")).toLowerCase() || "neutral",
    closingProbability: closingMatch ? Math.min(100, Math.max(0, Number(closingMatch[0]))) : 50,
    coachingFeedback: section(text, "KOÇLUK NOTU", rest("KOÇLUK NOTU")),
    nextSteps: section(text, "SONRAKI ADIMLAR", [])
  };
}

export async function analyzeSalesCall(params: {
  title: string;
  rawTranscript: string;
  leadId?: string | null;
  companyId?: string | null;
  recordType: "sales_call" | "meeting";
  createdBy: string | null;
}) {
  const transcript = params.rawTranscript.slice(0, 8000);
  const promptLabel = params.recordType === "meeting" ? "toplantı" : "satış görüşmesi";

  const ai = await executeAiTask({
    taskType: "document_analysis",
    module: params.recordType === "meeting" ? "Meeting Summarizer" : "AI Sales Coach",
    endpoint: "/api/admin/sales-calls",
    prompt: `Aşağıdaki ${promptLabel} dökümünü analiz et. Yalnızca dökümde gerçekten geçen bilgileri kullan, tarih veya sorumlu kişi uydurma. Tam olarak şu formatta yanıt ver:\nÖZET: (2-3 cümle)\nKARARLAR:\n- madde\nAKSİYONLAR:\n- madde (varsa sorumlu ve tarih dökümde geçtiği gibi)\nİTİRAZLAR:\n- madde\nDUYGU: (positive/neutral/negative)\nKAPANIŞ OLASILIĞI: (0-100 arası sayı)\nKOÇLUK NOTU: (satış temsilcisine 1-2 cümlelik geri bildirim)\nSONRAKI ADIMLAR: (kısa)\n\nDöküm:\n${transcript}`,
    expectedOutput: "Etiketli format analiz",
    fallbackText: "ÖZET: Analiz üretilemedi.\nKARARLAR:\nAKSİYONLAR:\nİTİRAZLAR:\nDUYGU: neutral\nKAPANIŞ OLASILIĞI: 50\nKOÇLUK NOTU:\nSONRAKI ADIMLAR:",
    createdBy: params.createdBy
  }, { cacheTtlMs: 0 });

  const parsed = parseCallAnalysis(ai.text);

  const inserted = await supabaseRest<Array<Record<string, unknown>>>("sales_call_analyses", {
    method: "POST",
    body: JSON.stringify({
      lead_id: params.leadId || null,
      company_id: params.companyId || null,
      title: params.title,
      record_type: params.recordType,
      transcript_source: "manual_text",
      raw_transcript: params.rawTranscript,
      summary: parsed.summary,
      decisions: parsed.decisions,
      action_items: parsed.actionItems,
      objections: parsed.objections,
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      closing_probability: parsed.closingProbability,
      coaching_feedback: parsed.coachingFeedback,
      next_steps: parsed.nextSteps,
      created_by: params.createdBy
    })
  });

  return inserted[0];
}

export async function syncActionItemsToTasks(callId: string) {
  const rows = await supabaseRest<Array<{ id: string; title: string; company_id: string | null; action_items: string[]; tasks_synced: boolean }>>(
    `sales_call_analyses?id=eq.${encodeURIComponent(callId)}&select=id,title,company_id,action_items,tasks_synced&limit=1`
  );
  const call = rows[0];
  if (!call || call.tasks_synced || !call.action_items.length) return { synced: 0 };

  for (const [index, item] of call.action_items.entries()) {
    await supabaseRest("agency_tasks", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        company_id: call.company_id,
        title: item.slice(0, 160),
        description: `"${call.title}" görüşmesinden çıkarılan aksiyon.`,
        status: "Yapılacak",
        priority: "Normal",
        automation_key: `meeting-${call.id}-${index}`
      })
    }).catch(() => null);
  }

  await supabaseRest(`sales_call_analyses?id=eq.${encodeURIComponent(callId)}`, {
    method: "PATCH",
    body: JSON.stringify({ tasks_synced: true })
  });

  return { synced: call.action_items.length };
}
