import { supabaseRest } from "./supabase";
import { isCustomerRole, type AppSession } from "./auth";

export type ActivityAction = "Giriş" | "Çıkış" | "Oluşturma" | "Güncelleme" | "Silme" | "Arşivleme" | "Yetki Değişikliği" | "API İşlemi" | "İçe Aktarma" | "Dışa Aktarma" | "Şifre Sıfırlama" | "Görüntüleme" | "İndirme" | "Dönüştürme";

export async function recordActivity({
  session,
  action,
  entity,
  entityId,
  companyId,
  details
}: {
  session?: AppSession | null;
  action: ActivityAction;
  entity: string;
  entityId?: string | null;
  companyId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseRest("activity_logs", {
      method: "POST",
      body: JSON.stringify({
        actor_user_id: session?.profileId || null,
        company_id: companyId || session?.companyId || null,
        actor_name: session?.fullName || session?.email || "Sistem",
        role: session?.role || "system",
        action,
        action_type: action,
        entity,
        module: entity,
        entity_id: entityId || null,
        details: details || {},
        old_value: details?.old_value || details?.oldValue || null,
        new_value: details?.new_value || details?.newValue || null,
        status: "Görülmedi",
        is_seen: false,
        is_critical: Boolean(details?.critical || details?.is_critical)
      })
    });
  } catch (error) {
    console.error("Aktivite kaydı oluşturulamadı:", error instanceof Error ? error.message : error);
  }
}

export async function recordActionFailure({
  session,
  entity,
  action,
  error,
  entityId,
  companyId
}: {
  session?: AppSession | null;
  entity: string;
  action: string;
  error: unknown;
  entityId?: string | null;
  companyId?: string | null;
}) {
  const message = error instanceof Error ? error.message : String(error || "Bilinmeyen hata");
  const errorCode = message.match(/\b(PGRST\d+|22P\d+|23\d+|42P\d+)\b/i)?.[1]?.toUpperCase() || "UNKNOWN";
  await recordActivity({
    session,
    action: "API İşlemi",
    entity,
    entityId,
    companyId,
    details: {
      message: `${action} başarısız oldu`,
      operation: action,
      result: "Hata",
      error: true,
      error_code: errorCode,
      error_message: message,
      critical: true
    }
  });
}

export async function recordCustomerLogin(session: AppSession) {
  if (!session.profileId || !isCustomerRole(session.role)) return;
  try {
    const rows = await supabaseRest<Array<{ login_count?: number }>>(
      `users?id=eq.${encodeURIComponent(session.profileId)}&select=login_count&limit=1`
    );
    await supabaseRest(`users?id=eq.${encodeURIComponent(session.profileId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        last_login_at: new Date().toISOString(),
        login_count: Number(rows[0]?.login_count || 0) + 1
      })
    });
  } catch (error) {
    console.error("Müşteri giriş bilgisi güncellenemedi:", error instanceof Error ? error.message : error);
  }

  await recordActivity({
    session,
    action: "Giriş",
    entity: "Müşteri Paneli",
    companyId: session.companyId,
    details: { message: "Müşteri paneline giriş yaptı" }
  });
}
