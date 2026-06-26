import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type AgentRunRow = {
  id?: string;
  created_at?: string | null;
  selected_provider?: string | null;
  status?: string | null;
  estimated_cost?: number | string | null;
};

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const logs = hasSupabaseConfig()
    ? await supabaseRest<AgentRunRow[]>("agent_runs?select=*&order=created_at.desc&limit=100").catch(() => [])
    : [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const monthLogs = logs.filter((item) => String(item.created_at || "").startsWith(month));
  const completed = logs.filter((item) => String(item.status || "").startsWith("completed")).length;
  const summary = {
    todayRuns: logs.filter((item) => String(item.created_at || "").startsWith(today)).length,
    monthRuns: monthLogs.length,
    estimatedCost: monthLogs.reduce((sum, item) => sum + Number(item.estimated_cost || 0), 0),
    successRate: logs.length ? Math.round((completed / logs.length) * 100) : 100
  };

  return NextResponse.json({ logs, summary });
}
