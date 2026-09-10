// Shared cron/manual auth for every social-autopilot route that a Vercel
// cron job also hits — same CRON_SECRET bearer-token pattern already used
// by growth-intelligence/run-daily and the other existing cron routes,
// factored out once here since this module adds several such routes.
import { requireModuleAccess } from "@/lib/permissions";
import { safeCompare } from "@/lib/secure-compare";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function cronAuthorized(request: Request) {
  return safeCompare(bearerToken(request), process.env.CRON_SECRET);
}

export async function authorizeManualOrCron(request: Request): Promise<"cron" | "manual" | null> {
  if (cronAuthorized(request)) return "cron";
  const session = await requireModuleAccess("social-autopilot");
  return session ? "manual" : null;
}
