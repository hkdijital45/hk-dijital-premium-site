import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";
import { listResetTargets, previewCompanyReset } from "@/lib/server/customer-permanent-delete";

// Read-only. Real, server-computed counts for the Data Reset Center's
// mandatory dry-run screen — nothing here deletes or modifies anything.
export async function GET(request: Request) {
  const session = await requireModuleAccess("veri-sifirlama");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!isAdminRole(session.role)) return NextResponse.json({ error: "Veri sıfırlama önizlemesini yalnızca admin rolü görüntüleyebilir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "demo" && mode !== "full") return NextResponse.json({ error: "Geçerli bir mod seçin: demo veya full." }, { status: 400 });

  try {
    const targets = await listResetTargets(mode);
    const preview = await previewCompanyReset(targets.map((item) => item.id));
    return NextResponse.json({ ok: true, mode, targets, preview });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Veri sıfırlama önizleme hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
