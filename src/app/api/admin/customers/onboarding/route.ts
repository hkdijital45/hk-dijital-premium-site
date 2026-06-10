/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole, updateSupabaseAuthUser } from "@/lib/auth";
import { createCustomerFromLead } from "@/lib/business-flow";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

function tempPassword() {
  return `HK-${Math.random().toString(36).slice(2, 8)}-${new Date().getFullYear()}`;
}

async function sendWelcomeEmail(email: string, name: string, password: string) {
  if (!process.env.RESEND_API_KEY || !email || email.endsWith("@hkdijital.local")) return { sent: false, reason: "E-posta sağlayıcısı yapılandırılmadı veya geçici yerel e-posta kullanıldı." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "HK Dijital <noreply@hkdijital.com.tr>",
      to: email,
      subject: "HK Dijital müşteri paneliniz hazır",
      html: `<p>Merhaba ${name},</p><p>HK Dijital müşteri paneliniz hazırlandı.</p><p>Geçici şifreniz: <strong>${password}</strong></p><p>Giriş yaptıktan sonra şifrenizi güncellemenizi öneririz.</p>`
    })
  });
  return { sent: response.ok, reason: response.ok ? "" : await response.text().catch(() => "E-posta gönderilemedi.") };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  try {
    const body = await request.json();
    if (body.action === "disable") {
      if (!body.userId) return NextResponse.json({ error: "Kullanıcı seçilmedi." }, { status: 400 });
      await supabaseRest(`users?id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ is_active: false }) });
      return NextResponse.json({ ok: true, message: "Müşteri hesabı pasifleştirildi." });
    }
    if (body.action === "regenerate-password") {
      if (!body.authUserId) return NextResponse.json({ error: "Auth kullanıcı bilgisi eksik." }, { status: 400 });
      const password = tempPassword();
      await updateSupabaseAuthUser(body.authUserId, { password, fullName: body.fullName || "" });
      return NextResponse.json({ ok: true, temporaryPassword: password, message: "Geçici şifre yenilendi." });
    }
    const lead = body.leadId ? (await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(body.leadId)}&select=*&limit=1`))[0] : body.lead;
    if (!lead) return NextResponse.json({ error: "Lead bulunamadı." }, { status: 404 });
    const result = await createCustomerFromLead(lead, { approve: true });
    const email = await sendWelcomeEmail(result.user?.email || lead.email, lead.name || result.company.name, result.temporaryPassword);
    return NextResponse.json({ ok: true, ...result, welcomeEmail: email, message: email.sent ? "Müşteri oluşturuldu ve hoş geldin e-postası gönderildi." : "Müşteri oluşturuldu. E-posta gönderimi yapılandırma bekliyor." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
