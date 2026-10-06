import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { buildBulkPlan, parseBulkRequest, type ContactRequestRow } from "@/lib/contact-requests";

// One set-based request per action. Writes touch contact_forms only; deleting a
// request never cascades to leads (converted_lead_id is a reference, not an owner).
export async function POST(request: Request) {
  const session = await requireModuleAccess("gelen-talepler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const parsed = parseBulkRequest(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const plan = buildBulkPlan(parsed.action, parsed.ids, new Date().toISOString());
  try {
    const rows = await supabaseRest<Array<Pick<ContactRequestRow, "id" | "status" | "read_at" | "converted_lead_id" | "converted_at">>>(plan.path, {
      method: plan.method,
      ...(plan.body ? { body: JSON.stringify(plan.body) } : {})
    });
    const changed = rows ?? [];
    const skipped = parsed.ids.length - changed.length;
    if (parsed.action === "delete") {
      return NextResponse.json({ ok: true, action: parsed.action, deletedIds: changed.map((row) => row.id), updated: changed.length, skipped });
    }
    return NextResponse.json({ ok: true, action: parsed.action, rows: changed, updated: changed.length, skipped });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
