import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";
import { getCostBreakdown } from "@/lib/ai-workforce";

export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const breakdown = await getCostBreakdown();
  return NextResponse.json(breakdown);
}
