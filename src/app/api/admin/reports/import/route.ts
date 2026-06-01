import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { extractReportFile } from "@/lib/reports/report-extractors";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Dosya seçin." }, { status: 400 });
    const extracted = await extractReportFile(file);
    return NextResponse.json({ ok: true, ...extracted, message: `${extracted.rowCount} satırdan rapor verisi çıkarıldı.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dosya ayrıştırılamadı." }, { status: 400 });
  }
}
