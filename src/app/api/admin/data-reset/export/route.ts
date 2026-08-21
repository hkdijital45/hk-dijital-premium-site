import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { exportCompanyResetBackup, listResetTargets } from "@/lib/server/customer-permanent-delete";

// Read-only JSON backup of everything a reset in this mode would touch —
// the mandatory pre-reset export/snapshot. Nothing here deletes anything;
// downloading a backup is logged the same way any other export is.
export async function GET(request: Request) {
  const session = await requireModuleAccess("veri-sifirlama");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!isAdminRole(session.role)) return NextResponse.json({ error: "Veri sıfırlama yedeğini yalnızca admin rolü indirebilir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "demo" && mode !== "full") return NextResponse.json({ error: "Geçerli bir mod seçin: demo veya full." }, { status: 400 });

  try {
    const targets = await listResetTargets(mode);
    const backup = await exportCompanyResetBackup(targets.map((item) => item.id));
    await recordActivity({
      session,
      action: "Dışa Aktarma",
      entity: "Veri Sıfırlama Merkezi",
      details: { message: `${mode === "demo" ? "Demo/test" : "Tüm müşteri"} verisi için sıfırlama öncesi yedek indirildi (${targets.length} müşteri).`, reset_mode: mode }
    });
    const filename = `hk-dijital-reset-backup-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify({ generatedAt: new Date().toISOString(), mode, ...backup }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Veri sıfırlama yedek hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
