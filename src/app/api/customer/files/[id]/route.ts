import { NextResponse } from "next/server";
import { getSession, isCustomerRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { supabaseRest } from "@/lib/supabase";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isCustomerRole(session.role) || !session.companyId) {
    return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  }

  const { id } = await context.params;
  const rows = await supabaseRest<any[]>(
    `customer_files?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(session.companyId)}&visible_to_customer=eq.true&select=*&limit=1`
  );
  const file = rows[0];
  if (!file?.file_url) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  await recordActivity({
    session,
    action: "İndirme",
    entity: "Müşteri Dosyası",
    entityId: file.id,
    companyId: session.companyId,
    details: { message: `${file.title} dosyasını görüntüledi`, title: file.title }
  });

  return NextResponse.redirect(file.file_url);
}
