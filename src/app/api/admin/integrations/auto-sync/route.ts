import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getIntegrations, syncIntegration, type IntegrationProvider } from "@/lib/business-flow";

async function canRun(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    return token === cronSecret;
  }
  const session = await getSession();
  return isStaffRole(session?.role);
}

export async function POST(request: Request) {
  if (!(await canRun(request))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const integrations = (await getIntegrations()).filter((item) => item.auto_sync);
  const results = [];
  for (const integration of integrations) {
    results.push(await syncIntegration(integration.provider as IntegrationProvider, integration.id));
  }
  return NextResponse.json({ ok: true, synced: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}
