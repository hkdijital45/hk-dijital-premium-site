import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getWebsiteAnalytics } from "@/lib/website-analytics";

export async function GET() {
  const session = await getSession();

  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  try {
    const analytics = await getWebsiteAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Website Analytics verisi hazırlanamadı.",
        detail: error instanceof Error ? error.message : "Beklenmeyen hata"
      },
      { status: 500 }
    );
  }
}
