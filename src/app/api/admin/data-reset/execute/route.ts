import { NextResponse } from "next/server";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";
import { listResetTargets, resetCompaniesOperationalData } from "@/lib/server/customer-permanent-delete";

const REQUIRED_PHRASE = "HK DIGITAL RESET";

// The Data Reset Center's only destructive endpoint. Requires, in order:
// an authenticated admin session with the veri-sifirlama module, the exact
// typed confirmation phrase (case-sensitive, matching what the UI shows the
// user to type), and an explicit second boolean confirmation from a
// separate confirm step — neither on its own is enough. This screen sits
// behind /hk-admin's own Secret Access Control Center gate already (see
// src/proxy.ts) the same as every other admin screen; this route does not
// duplicate that check the way no other admin API route in this codebase
// does either (Secret Access is a page-navigation gate, not a per-API-call
// one, everywhere else here) — this stays consistent with that rather than
// inventing a new, separately-unverified security path for one endpoint.
export async function POST(request: Request) {
  const session = await requireModuleAccess("veri-sifirlama");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!isAdminRole(session.role)) return NextResponse.json({ error: "Veri sıfırlamayı yalnızca admin rolü çalıştırabilir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const payload = await request.json().catch(() => ({}));
  const mode = payload.mode;
  if (mode !== "demo" && mode !== "full") return NextResponse.json({ error: "Geçerli bir mod seçin: demo veya full." }, { status: 400 });

  if (String(payload.confirmationPhrase || "") !== REQUIRED_PHRASE) {
    return NextResponse.json({ error: `Onay için tam olarak "${REQUIRED_PHRASE}" yazmalısınız.` }, { status: 400 });
  }
  if (payload.confirmSecond !== true) {
    return NextResponse.json({ error: "İkinci onay adımı tamamlanmadı." }, { status: 400 });
  }

  try {
    const targets = await listResetTargets(mode);
    if (!targets.length) {
      return NextResponse.json({ ok: true, mode, total: 0, succeeded: 0, results: [], message: mode === "demo" ? "Silinecek demo/test müşterisi bulunamadı." : "Silinecek müşteri bulunamadı." });
    }
    const result = await resetCompaniesOperationalData(mode, targets.map((item) => item.id), session);
    return NextResponse.json(result);
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Veri sıfırlama hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
