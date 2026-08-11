import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { hashSecret, generateStrongSecret } from "@/lib/hidden-access";

// Explicit DTO — never forward secret_hash (or any other raw row) to the client.
function toKeyDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    isActive: Boolean(row.is_active),
    expiresAt: row.expires_at,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at
  };
}

export async function GET() {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  try {
    const rows = await supabaseRest<any[]>("hidden_access_keys?select=*&order=created_at.desc");
    return NextResponse.json({ keys: rows.map(toKeyDto) });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Gizli Erişim Anahtarı", action: "Liste yükleme", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session || !session.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Anahtar adı zorunludur." }, { status: 400 });

  const secret = body.generateSecret ? generateStrongSecret() : String(body.secret || "").trim();
  if (!secret || secret.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalıdır." }, { status: 400 });

  const now = new Date().toISOString();
  try {
    const rows = await supabaseRest<any[]>("hidden_access_keys", {
      method: "POST",
      body: JSON.stringify({
        name,
        secret_hash: hashSecret(secret),
        is_active: true,
        expires_at: body.expiresAt || null,
        created_by: session.profileId,
        created_at: now,
        updated_at: now
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Anahtar oluşturulamadı." }, { status: 500 });
    await recordActivity({ session, action: "Oluşturma", entity: "Gizli Erişim Anahtarı", entityId: rows[0].id, details: { message: `"${name}" erişim anahtarı oluşturuldu` } });
    // The plaintext secret is returned exactly once, only to the admin who
    // just created it, over an already-authenticated HTTPS response that is
    // never cached (see route-level Cache-Control below) — it is never
    // stored or retrievable again after this response.
    return NextResponse.json({ ok: true, key: toKeyDto(rows[0]), secret }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Gizli Erişim Anahtarı", action: "Anahtar oluşturma", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
