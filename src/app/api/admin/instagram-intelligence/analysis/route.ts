import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { analyzeInstagramAccount, InstagramNotConnectedError } from "@/lib/instagram-intelligence/analysis";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  try {
    const analysis = await analyzeInstagramAccount();
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof InstagramNotConnectedError) {
      return NextResponse.json({ connected: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : "Instagram analiz edilirken beklenmeyen bir hata oluştu.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
