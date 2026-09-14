import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { generateHandbookPdfBuffer } from "@/lib/server/hk-admin-el-kitabi-pdf";

// Authenticated PDF download for the HK Admin El Kitabı — same
// requireModuleAccess("sistem-rehberi") boundary as the Sistem Rehberi page
// itself, never a public/static file, generated fresh from the bundled
// markdown + real screenshots on every request (the handbook is small
// enough — well under a second — that pre-generation/caching would be
// premature complexity).
export async function GET() {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  try {
    const buffer = await generateHandbookPdfBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="HK-Admin-El-Kitabi.pdf"',
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error("HK Admin El Kitabı PDF oluşturulamadı:", error);
    return NextResponse.json({ error: "El kitabı PDF'i oluşturulamadı." }, { status: 500 });
  }
}
