import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { readHandbookScreenshot } from "@/lib/server/hk-admin-el-kitabi";

// Authenticated image delivery for the handbook's real HK Admin screenshots
// — readHandbookScreenshot only ever resolves a name from its own bundled
// allowlist (never an arbitrary filesystem path), and this route sits
// behind the same sistem-rehberi module check as the rest of the handbook.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const session = await requireModuleAccess("sistem-rehberi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const { file } = await params;
  const bytes = readHandbookScreenshot(file);
  if (!bytes) return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" }
  });
}
