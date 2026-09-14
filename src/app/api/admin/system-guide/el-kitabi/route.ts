import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getHandbookChapters, getHandbookMeta } from "@/lib/server/hk-admin-el-kitabi";

// Chapter content (pre-rendered, sanitized HTML) for the native "El Kitabı"
// reader inside Sistem Rehberi — same auth boundary as the rest of the
// system guide and the PDF/screenshot routes below it.
export async function GET() {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  try {
    const chapters = getHandbookChapters();
    const meta = getHandbookMeta();
    return NextResponse.json({ chapters, meta });
  } catch (error) {
    console.error("HK Admin El Kitabı içeriği yüklenemedi:", error);
    return NextResponse.json({ error: "El kitabı içeriği yüklenemedi." }, { status: 500 });
  }
}
