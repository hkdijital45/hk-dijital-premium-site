/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  getSession,
  isStaffRole,
  updateSupabaseAuthUser
} from "@/lib/auth";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

function temporaryPassword() {
  return `Hk!${randomBytes(9).toString("base64url")}9`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { id } = await context.params;
  const options = await request.json().catch(() => ({}));
  try {
    const leads = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const lead = leads[0];
    if (!lead) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });

    let company;
    if (lead.company_id) {
      const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(lead.company_id)}&select=*&limit=1`);
      company = rows[0];
    }
    if (!company && lead.company) {
      const rows = await supabaseRest<any[]>(`companies?name=ilike.${encodeURIComponent(lead.company)}&select=*&limit=1`);
      company = rows[0];
    }
    if (!company && lead.phone) {
      const rows = await supabaseRest<any[]>(`companies?phone=eq.${encodeURIComponent(lead.phone)}&select=*&limit=1`);
      company = rows[0];
    }
    if (!company) {
      const rows = await supabaseRest<any[]>("companies", {
        method: "POST",
        body: JSON.stringify({
          name: lead.company || `${lead.name || "Yeni"} Müşterisi`,
          sector: lead.business_type || "",
          website: lead.website || "",
          instagram: lead.instagram || "",
          phone: lead.phone || "",
          email: lead.email || "",
          notes: [lead.goal && `Ana hedef: ${lead.goal}`, lead.budget && `Reklam bütçesi: ${lead.budget}`, lead.message].filter(Boolean).join("\n"),
          status: "Aktif"
        })
      });
      company = rows[0];
    }

    let profile = null;
    let generatedPassword = "";
    const email = String(lead.email || "").trim().toLowerCase();
    if (email) {
      const byEmail = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
      if (byEmail[0] && !["customer", "musteri"].includes(byEmail[0].role)) {
        return NextResponse.json({ error: "Bu e-posta adresi ekip hesabı olarak kullanılıyor. Müşteri hesabı için farklı bir e-posta girin." }, { status: 409 });
      }
      let authUser = await findSupabaseAuthUserByEmail(email);
      if (!authUser || !byEmail[0]) generatedPassword = temporaryPassword();
      authUser = authUser
        ? await updateSupabaseAuthUser(authUser.id, { email, ...(generatedPassword ? { password: generatedPassword } : {}), fullName: lead.name || "" })
        : await createSupabaseAuthUser({ email, password: generatedPassword, fullName: lead.name || "" });

      const profilePayload = {
        auth_user_id: authUser.id,
        email,
        full_name: lead.name || "",
        role: "musteri",
        company_id: company.id,
        is_active: true,
        updated_at: new Date().toISOString()
      };
      const rows = byEmail[0]
        ? await supabaseRest<any[]>(`users?id=eq.${byEmail[0].id}`, { method: "PATCH", body: JSON.stringify(profilePayload) })
        : await supabaseRest<any[]>("users", { method: "POST", body: JSON.stringify(profilePayload) });
      profile = rows[0];
    }

    const existingCustomers = await supabaseRest<any[]>(
      `customers?company_id=eq.${encodeURIComponent(company.id)}&select=*&limit=1`
    );
    const customerPayload = {
      company_id: company.id,
      user_id: profile?.id || existingCustomers[0]?.user_id || null,
      source_lead_id: lead.id,
      full_name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      instagram: lead.instagram || "",
      website: lead.website || "",
      sector: lead.business_type || "",
      goal: lead.goal || "",
      budget: lead.budget || "",
      notes: lead.notes || lead.message || "",
      status: "Aktif",
      updated_at: new Date().toISOString()
    };
    const customerRows = existingCustomers[0]
      ? await supabaseRest<any[]>(`customers?id=eq.${existingCustomers[0].id}`, { method: "PATCH", body: JSON.stringify(customerPayload) })
      : await supabaseRest<any[]>("customers", { method: "POST", body: JSON.stringify(customerPayload) });

    const visibilityRows = await supabaseRest<any[]>(
      `customer_visibility_settings?company_id=eq.${encodeURIComponent(company.id)}&select=id&limit=1`
    );
    if (!visibilityRows[0]) {
      await supabaseRest("customer_visibility_settings", {
        method: "POST",
        body: JSON.stringify({ company_id: company.id })
      });
    }

    const onboardingTasks = [
      ["Sözleşme ve teklif kontrolü", 0],
      ["Reklam hesap erişimleri", 1],
      ["Meta Pixel kontrolü", 2],
      ["İlk rapor tarihi planı", 7]
    ] as const;
    for (const [title, delay] of onboardingTasks) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + delay);
      await supabaseRest("agency_tasks?on_conflict=automation_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          company_id: company.id,
          lead_id: lead.id,
          automation_key: `lead:${lead.id}:onboarding:${title}`,
          title,
          description: `${lead.company || lead.name || "Yeni müşteri"} için onboarding görevi.`,
          notes: `${lead.company || lead.name || "Yeni müşteri"} için onboarding görevi.`,
          status: "Yapılacak",
          priority: delay < 2 ? "Yüksek" : "Normal",
          due_date: dueDate.toISOString().slice(0, 10),
          visible_to_customer: false,
          updated_at: new Date().toISOString()
        })
      });
    }

    if (options.createInitialPayment && Number(options.initialPaymentAmount || 0) > 0) {
      const paymentNote = `Lead dönüşümü başlangıç tahsilatı · ${lead.id}`;
      const existingPayments = await supabaseRest<any[]>(`payment_records?company_id=eq.${encodeURIComponent(company.id)}&payment_note=eq.${encodeURIComponent(paymentNote)}&select=id&limit=1`);
      if (!existingPayments[0]) {
        await supabaseRest("payment_records", {
          method: "POST",
          body: JSON.stringify({
            company_id: company.id,
            amount: Number(options.initialPaymentAmount),
            due_date: new Date().toISOString().slice(0, 10),
            status: "Bekliyor",
            payment_note: paymentNote,
            visible_to_customer: false,
            updated_at: new Date().toISOString()
          })
        });
      }
    }

    const updatedLeads = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ company_id: company.id, status: "Müşteri Oldu", pipeline_stage: "Kazanıldı", updated_at: new Date().toISOString() })
    });

    await recordActivity({
      session,
      action: "Dönüştürme",
      entity: "Başvuru",
      entityId: lead.id,
      companyId: company.id,
      details: { message: "Başvuru müşteriye dönüştürüldü", customer_id: customerRows[0]?.id }
    });

    return NextResponse.json({
      ok: true,
      message: "Başvuru başarıyla müşteriye dönüştürüldü.",
      company,
      customer: customerRows[0],
      user: profile,
      lead: updatedLeads[0],
      temporaryPassword: generatedPassword || undefined
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Başvuru dönüştürme Supabase hatası:", safeError.detail);
    await recordActionFailure({ session, entity: "Satış Hunisi", action: "Lead müşteriye dönüştürme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
