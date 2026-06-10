import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { generateProposal } from "@/lib/business-flow";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.businessName) return NextResponse.json({ error: "İşletme adı zorunludur." }, { status: 400 });
  const proposal = await generateProposal(body);
  return NextResponse.json({ ok: true, proposal });
}
