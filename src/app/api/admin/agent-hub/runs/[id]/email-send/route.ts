import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  email_draft?: { subject?: string; body?: string; customerEmail?: string | null } | null;
  final_report?: { customerMessageDraft?: string; recommendedActions?: string[] } | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rows = hasSupabaseConfig()
    ? await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });

  const draft = run.email_draft || {};
  const to = String(body.to || draft.customerEmail || "").trim();
  if (!to) return NextResponse.json({ ok: false, status: "missing_email", message: "Bu müşterinin e-posta adresi kayıtlı değil." });

  const subject = String(body.subject || draft.subject || "HK Dijital analiz ve aksiyon önerileri");
  const text = String(body.body || draft.body || run.final_report?.customerMessageDraft || "HK Dijital analiz taslağı hazırlandı.");
  const from = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || "HK Dijital <noreply@hkdijital.com>";

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, status: "mail_not_configured", message: "E-posta sağlayıcısı yapılandırılmadı. RESEND_API_KEY veya SMTP ayarları eklenmeli." });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text })
  });
  if (!response.ok) return NextResponse.json({ ok: false, status: "send_failed", message: "E-posta gönderimi başarısız oldu." }, { status: 502 });

  const sentDraft = { ...draft, customerEmail: to, subject, body: text, status: "sent", sentAt: new Date().toISOString() };
  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ email_draft: sentDraft, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, status: "sent" });
}
