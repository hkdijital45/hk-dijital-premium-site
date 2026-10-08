import { NextResponse } from "next/server";
import { requireMobileModuleAccess } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const FIELDS = "id,company_id,title,description,status,priority,due_date,assigned_user_id,visible_to_customer,completed_at,created_at";

// Real agency_tasks rows (public.agency_tasks) — the same table and status
// enum ("Yapılacak"|"Devam Ediyor"|"Beklemede"|"Tamamlandı"|"İptal") the web
// Görevler module uses. No separate mobile task model.
export async function GET(request: Request) {
  const session = requireMobileModuleAccess(request, "gorevler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = `agency_tasks?select=${FIELDS}&archived_at=is.null&order=due_date.asc.nullslast&limit=200`;
  if (status && status !== "Tümü") query += `&status=eq.${encodeURIComponent(status)}`;

  try {
    const tasks = await supabaseRest<Array<Record<string, unknown>>>(query);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
