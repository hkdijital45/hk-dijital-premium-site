import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getCandidateEvaluationById } from "@/lib/candidate-evaluation/reports";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await context.params;
  try {
    const report = await getCandidateEvaluationById(id);
    if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
