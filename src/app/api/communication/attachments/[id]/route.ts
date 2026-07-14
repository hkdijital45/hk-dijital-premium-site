import { NextResponse } from "next/server";
import { getAccessibleConversation, getCommunicationContext, isUuid } from "@/lib/server/customer-communication";
import { supabaseRest } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Geçersiz dosya kaydı." }, { status: 400 });
  const rows = await supabaseRest<Array<{ conversation_id: string; storage_bucket: string; storage_path: string }>>(
    `conversation_attachments?id=eq.${id}&select=conversation_id,storage_bucket,storage_path&limit=1`
  ).catch(() => []);
  const attachment = rows[0];
  if (!attachment || !await getAccessibleConversation(context, attachment.conversation_id)) {
    return NextResponse.json({ error: "Dosya bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return NextResponse.json({ error: "Dosya servisi yapılandırılmadı." }, { status: 503 });
  const response = await fetch(`${baseUrl}/storage/v1/object/sign/${attachment.storage_bucket}/${attachment.storage_path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 })
  });
  const payload = await response.json().catch(() => ({}));
  const signedPath = payload.signedURL || payload.signedUrl;
  if (!response.ok || !signedPath) return NextResponse.json({ error: "Dosya bağlantısı oluşturulamadı." }, { status: 502 });
  const url = signedPath.startsWith("http") ? signedPath : `${baseUrl}/storage/v1${signedPath}`;
  return NextResponse.redirect(url);
}
