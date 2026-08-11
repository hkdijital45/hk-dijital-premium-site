import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { hashSecret, generateStrongSecret } from "@/lib/hidden-access";

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

// Single PATCH endpoint branching on `action` — rename / enable-disable /
// set-expiry / change-secret / archive all mutate the same row and don't
// warrant five separate route files (see task's own "don't multiply the API
// surface" guidance).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir anahtar seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "update");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  let activityMessage = "Erişim anahtarı güncellendi";
  let newSecret: string | null = null;

  if (action === "rename") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Anahtar adı boş olamaz." }, { status: 400 });
    patch.name = name;
    activityMessage = "Erişim anahtarı yeniden adlandırıldı";
  } else if (action === "set_active") {
    patch.is_active = Boolean(body.isActive);
    activityMessage = body.isActive ? "Erişim anahtarı aktifleştirildi" : "Erişim anahtarı pasifleştirildi";
  } else if (action === "set_expiry") {
    patch.expires_at = body.expiresAt || null;
    activityMessage = "Erişim anahtarı son kullanma tarihi güncellendi";
  } else if (action === "change_secret") {
    newSecret = body.generateSecret ? generateStrongSecret() : String(body.secret || "").trim();
    if (!newSecret || newSecret.length < 8) return NextResponse.json({ error: "Parola en az 8 karakter olmalıdır." }, { status: 400 });
    patch.secret_hash = hashSecret(newSecret);
    activityMessage = "Erişim anahtarı parolası değiştirildi";
  } else if (action === "archive") {
    patch.archived_at = now;
    patch.is_active = false;
    activityMessage = "Erişim anahtarı arşivlendi";
  } else if (action === "unarchive") {
    patch.archived_at = null;
    activityMessage = "Erişim anahtarı arşivden çıkarıldı";
  } else {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<any[]>(`hidden_access_keys?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows[0]) return NextResponse.json({ error: "Anahtar bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Güncelleme", entity: "Gizli Erişim Anahtarı", entityId: id, details: { message: activityMessage } });
    return NextResponse.json({ ok: true, key: toKeyDto(rows[0]), secret: newSecret }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Gizli Erişim Anahtarı", action: activityMessage, error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
