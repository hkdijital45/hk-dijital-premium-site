import { NextResponse } from "next/server";
import { getAccessibleTeamConversation, getTeamContext, isUuid, recordTeamActivity } from "@/lib/server/team-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

function hasExpectedSignature(bytes: Uint8Array, mimeType: string) {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (mimeType === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (mimeType === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mimeType === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (mimeType === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(mimeType)) return starts(0x50, 0x4b, 0x03, 0x04);
  if (["application/msword", "application/vnd.ms-excel"].includes(mimeType)) return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTeamContext();
  if (!context) return NextResponse.json({ error: "Ekip iletişimine erişim yetkiniz yok." }, { status: 403 });
  const { id } = await params;
  const conversation = await getAccessibleTeamConversation(context, id);
  if (!conversation) return NextResponse.json({ error: "Ekip konuşması bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const messageId = String(formData.get("messageId") || "");
    if (!(file instanceof File)) return NextResponse.json({ error: "Yüklenecek dosya bulunamadı." }, { status: 400 });
    if (!isUuid(messageId)) return NextResponse.json({ error: "Dosya geçerli bir mesaja bağlanmalıdır." }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Bu dosya türü desteklenmiyor." }, { status: 415 });
    if (!file.size || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Dosya boyutu 10 MB sınırını aşamaz." }, { status: 413 });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedSignature(fileBuffer.subarray(0, 16), file.type)) return NextResponse.json({ error: "Dosya içeriği bildirilen dosya türüyle eşleşmiyor." }, { status: 415 });
    const message = await supabaseRest<Array<{ id: string }>>(`team_messages?id=eq.${messageId}&conversation_id=eq.${id}&select=id&limit=1`);
    if (!message[0]) return NextResponse.json({ error: "Dosyanın bağlanacağı mesaj bulunamadı." }, { status: 404 });
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !key) throw new Error("Supabase Storage yapılandırılmadı.");
    const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr").replace(/[^a-z0-9]/g, "") || "bin";
    const storagePath = `team/${id}/${crypto.randomUUID()}.${extension}`;
    const upload = await fetch(`${baseUrl}/storage/v1/object/communication-attachments/${storagePath}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
      body: fileBuffer
    });
    if (!upload.ok) throw new Error("Dosya depolama alanına yüklenemedi.");
    try {
      const rows = await supabaseRest<Array<{ id: string }>>("team_attachments", {
        method: "POST",
        body: JSON.stringify({ conversation_id: id, message_id: messageId, uploaded_by: context.profileId, storage_path: storagePath, original_name: file.name.slice(0, 240), mime_type: file.type, file_size: file.size })
      });
      await recordTeamActivity(id, context.profileId, "team_attachment_uploaded", { message_id: messageId, attachment_id: rows[0]?.id || null });
      return NextResponse.json({ ok: true, attachmentId: rows[0]?.id }, { status: 201 });
    } catch (error) {
      await fetch(`${baseUrl}/storage/v1/object/communication-attachments/${storagePath}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => null);
      throw error;
    }
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
