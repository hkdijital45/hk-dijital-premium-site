import { NextResponse } from "next/server";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { supabaseRest } from "@/lib/supabase";
import { canSessionAccessResourceBranch } from "@/lib/server/branch-access";

type CustomerFileRow = { id: string; branch_id?: string | null; file_url?: string | null; document_url?: string | null; url?: string | null; title?: string | null };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (isCustomerPasswordChangeRequired(session)) return NextResponse.json({ error: "Önce geçici şifrenizi değiştirmeniz gerekiyor.", redirectTo: "/sifre-degistir" }, { status: 403 });
  if (!session || !isCustomerRole(session.role) || !session.companyId) {
    return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  }

  const { id } = await context.params;
  const rows = await supabaseRest<CustomerFileRow[]>(
    `customer_files?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(session.companyId)}&visible_to_customer=eq.true&select=*&limit=1`
  );
  const file = rows[0];
  if (file && !(await canSessionAccessResourceBranch(session, session.companyId, file.branch_id))) {
    return NextResponse.json({ error: "Bu şubeye ait dosyayı görüntüleme yetkiniz yok." }, { status: 403 });
  }
  const fileUrl = file?.file_url || file?.document_url || file?.url;
  if (!fileUrl) {
    return NextResponse.json({ error: "Dosya bağlantısı bulunamadı." }, { status: 404 });
  }

  await recordActivity({
    session,
    action: "İndirme",
    entity: "Müşteri Dosyası",
    entityId: file.id,
    companyId: session.companyId,
    details: { message: `${file.title} dosyasını görüntüledi`, title: file.title }
  });

  return NextResponse.redirect(fileUrl);
}
