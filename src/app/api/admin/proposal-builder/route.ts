import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { generateProposal } from "@/lib/business-flow";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.businessName) return NextResponse.json({ error: "İşletme adı zorunludur." }, { status: 400 });
  const companyId = body.companyId || body.company_id;
  if (companyId) {
    const customerCheck = await checkOperationalCustomer(companyId);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
  }
  const proposal = await generateProposal(body);
  return NextResponse.json({ ok: true, proposal });
}
