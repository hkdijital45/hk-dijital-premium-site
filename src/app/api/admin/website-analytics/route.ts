import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getWebsiteAnalytics } from "@/lib/website-analytics";

export async function GET(request: Request) {
  const session = await getSession();

  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const start = params.get("start") || undefined;
  const end = params.get("end") || undefined;
  const daysParam = Number(params.get("days"));
  const days = ([1, 7, 30] as const).includes(daysParam as 1 | 7 | 30) ? (daysParam as 1 | 7 | 30) : 7;

  try {
    const analytics = await getWebsiteAnalytics(start && end ? { start, end } : { days });
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
