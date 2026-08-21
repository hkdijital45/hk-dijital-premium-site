import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { requireModuleAccess } from "@/lib/permissions";
import { uploadCustomerDocument } from "@/lib/customer-assets";

// Real Supabase Storage upload for the Customer Profile "Dosyalar" tab —
// replaces the previous manual-URL-only flow. Reuses the same private
// `customer-assets` bucket and service-role upload mechanism already proven
// for brand assets (src/lib/customer-assets.ts), so this is not a new
// storage integration, just a second real consumer of it.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const fileId = String(form.get("fileId") || "");
    const documentType = form.get("documentType") ? String(form.get("documentType")) : null;
    if (!(file instanceof File)) return NextResponse.json({ error: "Yüklenecek dosya bulunamadı." }, { status: 400 });
    if (!uuidPattern.test(fileId)) return NextResponse.json({ error: "Geçerli bir belge kaydı seçin." }, { status: 400 });

    const result = await uploadCustomerDocument(id, file);
    const rows = await supabaseRest<any[]>(`customer_files?id=eq.${fileId}&company_id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        file_url: result.url,
        document_url: result.url,
        storage_path: result.path,
        mime_type: result.mimeType,
        file_size: result.size,
        file_type: documentType || undefined,
        uploaded_by: session.profileId || null,
        updated_at: new Date().toISOString()
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Belge kaydı bulunamadı." }, { status: 404 });

    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Müşteri Dosyası",
      entityId: fileId,
      companyId: id,
      details: { message: `Dosya yüklendi: ${result.fileName}`, result: "Başarılı" }
    }).catch(() => null);

    return NextResponse.json({ ok: true, file: rows[0], message: "Dosya yüklendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Dosyası", action: "Dosya yükleme", error, companyId: id }).catch(() => null);
    // Same distinction as the customer_documents upload route: keep
    // validate*'s own clean Turkish messages as-is, replace only raw
    // Supabase REST/Storage errors with getSafeSupabaseError's generic,
    // user-safe title so no raw backend error text reaches the client.
    const rawMessage = error instanceof Error ? error.message : "";
    const isRawBackendError = rawMessage.startsWith("Supabase REST hatası") || rawMessage.includes("Supabase Storage");
    return NextResponse.json({ error: isRawBackendError ? safe.title : (rawMessage || "Dosya yüklenemedi.") }, { status: 500 });
  }
}
