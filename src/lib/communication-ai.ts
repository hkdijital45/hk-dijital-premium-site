import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

type ParsedInsight = { summary: string; sentiment: string; action_items: string[]; suggested_reply: string };

function parseLabeledInsight(text: string): ParsedInsight {
  const summaryMatch = text.match(/ÖZET:\s*(.+)/i);
  const sentimentMatch = text.match(/DUYGU:\s*(.+)/i);
  const replyMatch = text.match(/ÖNERİLEN YANIT:\s*([\s\S]+)/i);
  const actionsBlock = text.match(/AKSİYONLAR:\s*([\s\S]*?)(?:ÖNERİLEN YANIT:|$)/i)?.[1] || "";
  const actionItems = actionsBlock.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 6);

  return {
    summary: summaryMatch?.[1]?.trim() || text.slice(0, 240),
    sentiment: (sentimentMatch?.[1]?.trim().toLowerCase() || "neutral").replace(/[^a-zçığöşü]/gi, ""),
    action_items: actionItems,
    suggested_reply: replyMatch?.[1]?.trim() || ""
  };
}

export function getCommunicationChannelStatus() {
  return [
    { channel: "whatsapp", label: "WhatsApp Business", configured: Boolean(process.env.WHATSAPP_BUSINESS_TOKEN) },
    { channel: "instagram", label: "Instagram DM", configured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN) },
    { channel: "slack", label: "Slack", configured: Boolean(process.env.SLACK_BOT_TOKEN) },
    { channel: "email", label: "E-posta (Resend)", configured: Boolean(process.env.RESEND_API_KEY) }
  ];
}

export async function generateConversationInsight(conversationId: string) {
  const [conversation, messages] = await Promise.all([
    supabaseRest<Array<{ id: string; subject: string; category: string }>>(`customer_conversations?id=eq.${encodeURIComponent(conversationId)}&select=id,subject,category&limit=1`),
    supabaseRest<Array<{ sender_type: string; body: string }>>(`customer_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&deleted_at=is.null&select=sender_type,body&order=created_at.desc&limit=20`)
  ]);

  if (!conversation.length) throw new Error("Konuşma bulunamadı.");
  const transcript = messages.reverse().map((message) => `${message.sender_type === "customer" ? "Müşteri" : "Ekip"}: ${message.body}`).join("\n").slice(0, 6000);

  const ai = await executeAiTask({
    taskType: "customer_message",
    module: "Communication Hub",
    endpoint: "/api/admin/communication/insights",
    prompt: `Aşağıdaki müşteri konuşmasını analiz et. Konu: ${conversation[0].subject}. Tam olarak şu formatta yanıt ver:\nÖZET: (1-2 cümle)\nDUYGU: (positive/neutral/negative/urgent)\nAKSİYONLAR:\n- madde\nÖNERİLEN YANIT: (kısa, profesyonel bir taslak yanıt)\n\nKonuşma:\n${transcript}`,
    expectedOutput: "ÖZET/DUYGU/AKSİYONLAR/ÖNERİLEN YANIT formatında analiz",
    fallbackText: "ÖZET: Konuşma özeti üretilemedi.\nDUYGU: neutral\nAKSİYONLAR:\n- Konuşmayı manuel inceleyin.\nÖNERİLEN YANIT: ",
    createdBy: null
  }, { cacheTtlMs: 10 * 60_000 });

  const parsed = parseLabeledInsight(ai.text);
  const inserted = await supabaseRest<Array<Record<string, unknown>>>("communication_ai_insights", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      summary: parsed.summary,
      sentiment: ["positive", "neutral", "negative", "urgent"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      action_items: parsed.action_items,
      suggested_reply: parsed.suggested_reply,
      model: ai.model
    })
  });

  return inserted[0];
}
