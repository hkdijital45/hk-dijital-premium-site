import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { generateHandbookPdfBuffer } from "@/lib/server/hk-admin-el-kitabi-pdf";

// Authenticated PDF download for the HK Admin El Kitabı — same
// requireModuleAccess("sistem-rehberi") boundary as the Sistem Rehberi page
// itself, never a public/static file. Content is static (bundled markdown +
// screenshots, never changes at runtime), so the generated buffer is cached
// per warm serverless instance rather than re-generated on every request —
// measured at ~18s on Vercel (embedding 7 screenshots + a two-pass
// page-numbered TOC layout is real work, not something a button click
// should pay for twice). First request per cold start still pays that cost;
// every request after reuses it until the instance recycles.
let cachedPdf: Buffer | null = null;

export async function GET() {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  try {
    if (!cachedPdf) cachedPdf = await generateHandbookPdfBuffer();
    return new NextResponse(new Uint8Array(cachedPdf), {
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
