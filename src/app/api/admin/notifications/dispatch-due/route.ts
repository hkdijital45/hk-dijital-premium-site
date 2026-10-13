import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import {
  notifyProposalExpiringSoon, notifyProposalExpired,
  notifyCampaignEndingSoon, notifyCampaignEnded,
  notifyTaskReminderDue, notifyTaskOverdue
} from "@/lib/notifications/events";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

async function authorizeManualOrCron(request: Request): Promise<"cron" | "manual" | null> {
  if (cronAuthorized(request)) return "cron";
  const session = await requireModuleAccess("teklifler") || await requireModuleAccess("gorevler") || await requireModuleAccess("kampanyalar");
  return session ? "manual" : null;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Scans real, already-persisted due dates (proposals.valid_until,
// campaigns.end_date, agency_tasks.due_date/reminder_at) and fires the
// matching notification event. Idempotency keys (date-scoped where
// relevant) make this safe to run more than once a day without
// duplicate notifications.
async function run() {
  const now = today();
  const soon = daysFromNow(3);
  const counts = { proposalsExpiringSoon: 0, proposalsExpired: 0, campaignsEndingSoon: 0, campaignsEnded: 0, taskReminders: 0, tasksOverdue: 0 };

  type ProposalRow = { id: string; target_label: string; created_by: string | null; valid_until: string; status: string };
  const expiringSoonProposals = await supabaseRest<ProposalRow[]>(
    `proposals?status=eq.Gönderildi&valid_until=lte.${soon}&valid_until=gte.${now}&select=id,target_label,created_by,valid_until,status`
  ).catch(() => []);
  for (const proposal of expiringSoonProposals) {
    await notifyProposalExpiringSoon(proposal);
    counts.proposalsExpiringSoon++;
  }

  const expiredProposals = await supabaseRest<ProposalRow[]>(
    `proposals?status=eq.Gönderildi&valid_until=lt.${now}&select=id,target_label,created_by,valid_until,status`
  ).catch(() => []);
  for (const proposal of expiredProposals) {
    await supabaseRest(`proposals?id=eq.${proposal.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "Süresi Doldu" })
    }).catch(() => {});
    await notifyProposalExpired(proposal);
    counts.proposalsExpired++;
  }

  type CampaignRow = { id: string; name?: string; company_id: string; end_date: string; status?: string };
  const endingSoonCampaigns = await supabaseRest<CampaignRow[]>(
    `campaigns?status=eq.active&end_date=lte.${soon}&end_date=gte.${now}&select=id,name,company_id,end_date,status`
  ).catch(() => []);
  for (const campaign of endingSoonCampaigns) {
    await notifyCampaignEndingSoon(campaign);
    counts.campaignsEndingSoon++;
  }

  const endedCampaigns = await supabaseRest<CampaignRow[]>(
    `campaigns?status=eq.active&end_date=lt.${now}&select=id,name,company_id,end_date,status`
  ).catch(() => []);
  for (const campaign of endedCampaigns) {
    await notifyCampaignEnded(campaign);
    counts.campaignsEnded++;
  }

  type TaskRow = { id: string; title: string; due_date: string; reminder_at?: string | null; completed_at?: string | null; status?: string };
  const reminderTasks = await supabaseRest<TaskRow[]>(
    `agency_tasks?status=neq.Tamamlandı&completed_at=is.null&reminder_at=lte.${new Date().toISOString()}&select=id,title,due_date,reminder_at,completed_at,status`
  ).catch(() => []);
  for (const task of reminderTasks) {
    await notifyTaskReminderDue(task);
    counts.taskReminders++;
  }

  const overdueTasks = await supabaseRest<TaskRow[]>(
    `agency_tasks?status=neq.Tamamlandı&completed_at=is.null&due_date=lt.${now}&select=id,title,due_date,completed_at,status`
  ).catch(() => []);
  for (const task of overdueTasks) {
    await notifyTaskOverdue(task);
    counts.tasksOverdue++;
  }

  return counts;
}

async function handle(request: Request) {
  const mode = await authorizeManualOrCron(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const counts = await run();
    return NextResponse.json({ ok: true, mode, counts });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) { return handle(request); }
export async function GET(request: Request) { return handle(request); }
