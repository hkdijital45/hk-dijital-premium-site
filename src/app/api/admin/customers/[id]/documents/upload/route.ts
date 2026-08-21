import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { requireModuleAccess } from "@/lib/permissions";
import { uploadCustomerDocument } from "@/lib/customer-assets";

// Real local-file upload for the "Yeni Belge" / Belge Merkezi flow — the
// previous flow only ever let you type an external document_url. Creates
// the customer_documents row and the real storage upload in one request
// (unlike the customer_files upload route, which PATCHes a pre-existing
// draft row) so there is never an orphaned draft document left behind if
// the upload itself fails.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const documentType = String(form.get("documentType") || "Diğer");
    const visibleToCustomer = form.get("visibleToCustomer") === "true";
    if (!(file instanceof File)) return NextResponse.json({ error: "Yüklenecek dosya bulunamadı." }, { status: 400 });

    const uploaded = await uploadCustomerDocument(id, file);
    const rows = await supabaseRest<any[]>("customer_documents", {
      method: "POST",
      body: JSON.stringify({
        company_id: id,
        title: title || uploaded.fileName,
        document_type: documentType,
        document_url: uploaded.url,
        storage_path: uploaded.path,
        mime_type: uploaded.mimeType,
        file_size: uploaded.size,
        document_date: new Date().toISOString().slice(0, 10),
        source_module: "Manual Upload",
        created_by: session.profileId || null,
        visible_to_customer: visibleToCustomer
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Belge kaydı oluşturulamadı." }, { status: 500 });

    await recordActivity({
      session,
      action: "Oluşturma",
      entity: "Müşteri Belgesi",
      entityId: rows[0].id,
      companyId: id,
      details: { message: `Belge yüklendi: ${uploaded.fileName}`, source_module: "Manual Upload" }
    }).catch(() => null);

    return NextResponse.json({ ok: true, document: rows[0], message: "Dosya başarıyla yüklendi ve müşteri belgelerine eklendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Belgesi", action: "Belge yükleme", error, companyId: id }).catch(() => null);
    // Validation errors thrown by uploadCustomerDocument/validateCustomerDocumentFile
    // are already clean, specific, Turkish user-facing messages ("Dosya boyutu
    // ... aşıyor" etc.) — only messages that came from the raw Supabase REST
    // layer (recognizable by supabaseRest()'s own error-message prefix) get
    // replaced with getSafeSupabaseError's generic, user-safe category title,
    // so a real Postgres/schema error never reaches the client as raw text.
    const rawMessage = error instanceof Error ? error.message : "";
    const isRawBackendError = rawMessage.startsWith("Supabase REST hatası") || rawMessage.includes("Supabase Storage");
    return NextResponse.json({ error: isRawBackendError ? safe.title : (rawMessage || "Dosya yüklenemedi.") }, { status: 500 });
  }
}
