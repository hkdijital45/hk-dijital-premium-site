import "server-only";
import { supabaseRest } from "@/lib/supabase";

const DEFAULT_TASK_HOURS = 2;

function startOfWeekIso(reference = new Date()) {
  const date = new Date(reference);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

export async function getWeeklyCapacityBoard(weekStart?: string) {
  const start = weekStart || startOfWeekIso();
  const end = addDaysIso(start, 6);

  const [profiles, users, weekTasks] = await Promise.all([
    safeFetch<Array<{ user_id: string; weekly_hours: number; skills: string[]; is_active: boolean }>>(
      "user_capacity_profiles?is_active=eq.true&select=user_id,weekly_hours,skills,is_active",
      []
    ),
    safeFetch<Array<{ id: string; full_name: string }>>("users?is_active=eq.true&select=id,full_name&limit=200", []),
    safeFetch<Array<{ assigned_user_id: string | null; estimated_hours: number | null; status: string; company_id: string }>>(
      `agency_tasks?due_date=gte.${start}&due_date=lte.${end}&completed_at=is.null&select=assigned_user_id,estimated_hours,status,company_id&limit=2000`,
      []
    )
  ]);

  const userNameById = new Map(users.map((user) => [user.id, user.full_name]));

  return profiles.map((profile) => {
    const tasks = weekTasks.filter((task) => task.assigned_user_id === profile.user_id && task.status !== "Tamamlandı");
    const allocatedHours = tasks.reduce((sum, task) => sum + (task.estimated_hours ?? DEFAULT_TASK_HOURS), 0);
    const remainingHours = Math.max(0, profile.weekly_hours - allocatedHours);
    const utilizationPercent = profile.weekly_hours > 0 ? Math.round((allocatedHours / profile.weekly_hours) * 100) : 0;
    const uniqueCustomers = new Set(tasks.map((task) => task.company_id).filter(Boolean)).size;

    return {
      userId: profile.user_id,
      name: userNameById.get(profile.user_id) || "Ekip üyesi",
      weeklyHours: profile.weekly_hours,
      skills: profile.skills,
      allocatedHours,
      remainingHours,
      utilizationPercent,
      taskCount: tasks.length,
      customerCount: uniqueCustomers,
      overloaded: utilizationPercent > 100,
      tasksHadEstimate: tasks.some((task) => task.estimated_hours !== null)
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

export async function upsertCapacityProfile(userId: string, weeklyHours: number, skills: string[]) {
  return supabaseRest("user_capacity_profiles?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: userId, weekly_hours: weeklyHours, skills, is_active: true })
  });
}
