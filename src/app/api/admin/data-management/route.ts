/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth";
import { permanentlyDeleteCompany, permanentlyDeleteLead } from "@/lib/server/customer-permanent-delete";

// Minimal "Veri Yönetimi" backend for the System Settings area: preview
// affected-record counts (GET) and execute permanent bulk deletes (POST) for
// customers/leads. Reuses the exact same per-record cleanup+delete logic as
// the single-item routes so there is only one real deletion code path.

const CONFIRMATION_PHRASE = "TÜMÜNÜ SİL";
const RESOURCES = ["customer", "lead"] as const;
type Resource = (typeof RESOURCES)[number];
type Scope = "selected" | "archived_all" | "all";

async function requireDataManagementAccess() {
  const session = await requireModuleAccess("site-ayarlari");
  if (!session || !isAdminRole(session.role)) return null;
  return session;
}

async function archivedCompanyIds() {
  const rows = await supabaseRest<Array<{ id: string }>>(
    `companies?or=(status.eq.Silindi,deleted_at.not.is.null)&select=id`
  );
  return rows.map((row) => row.id);
}

async function allLeadIds() {
  const rows = await supabaseRest<Array<{ id: string }>>("leads?select=id");
  return rows.map((row) => row.id);
}

export async function GET(request: Request) {
  const session = await requireDataManagementAccess();
  if (!session) return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const query = new URL(request.url).searchParams;
  const resource = query.get("resource") as Resource;
  const scope = (query.get("scope") || "selected") as Scope;
  if (!RESOURCES.includes(resource)) return NextResponse.json({ error: "Geçersiz kaynak." }, { status: 400 });

  try {
    if (resource === "customer") {
      const ids = scope === "archived_all" ? await archivedCompanyIds() : (query.get("ids") || "").split(",").filter(Boolean);
      return NextResponse.json({ count: ids.length });
    }
    const ids = scope === "all" ? await allLeadIds() : (query.get("ids") || "").split(",").filter(Boolean);
    return NextResponse.json({ count: ids.length });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireDataManagementAccess();
  if (!session) return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const resource = body.resource as Resource;
  const scope = (body.scope || "selected") as Scope;
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((value: unknown) => typeof value === "string") : [];
  const confirmationPhrase = String(body.confirmationPhrase || "").trim();

  if (!RESOURCES.includes(resource)) return NextResponse.json({ error: "Geçersiz kaynak." }, { status: 400 });
  if (scope !== "selected" && confirmationPhrase !== CONFIRMATION_PHRASE) {
    return NextResponse.json({ error: `Toplu silme için "${CONFIRMATION_PHRASE}" yazarak onaylayın.` }, { status: 400 });
  }
  if (scope === "selected" && ids.length > 1 && confirmationPhrase !== CONFIRMATION_PHRASE) {
    return NextResponse.json({ error: `Çoklu silme için "${CONFIRMATION_PHRASE}" yazarak onaylayın.` }, { status: 400 });
  }

  try {
    let targetIds = ids;
    if (resource === "customer" && scope === "archived_all") targetIds = await archivedCompanyIds();
    if (resource === "lead" && scope === "all") targetIds = await allLeadIds();
    if (!targetIds.length) return NextResponse.json({ error: "Silinecek kayıt bulunamadı." }, { status: 400 });

    const results = await Promise.all(
      targetIds.map(async (id) => {
        const result = resource === "customer" ? await permanentlyDeleteCompany(id, session) : await permanentlyDeleteLead(id, session);
        return { id, ok: result.ok, error: result.ok ? null : result.error };
      })
    );
    const deletedCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - deletedCount;
    return NextResponse.json({ ok: true, deletedCount, failedCount, results });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
