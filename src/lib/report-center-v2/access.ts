// Rapor Merkezi V2 authorization. Two server-side gates for every request:
//   1. the "rapor-merkezi" module, and
//   2. at least one of the report type's own source modules (the same
//      module its original screen/export already requires),
// so the central screen never widens access beyond the source modules.
import "server-only";

import { NextResponse } from "next/server";
import { getSession, type AppSession } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { REPORT_TYPES, REPORT_TYPE_BY_KEY, type ReportOwnerType, type ReportTypeDefinition, type ReportTypeKey } from "./catalog";
import { ReportCenterError } from "./server";

export function accessibleReportTypes(session: AppSession | null | undefined): ReportTypeDefinition[] {
  if (!session || !canAccessModule(session, "rapor-merkezi")) return [];
  return REPORT_TYPES.filter((def) => def.modules.some((module) => canAccessModule(session, module)));
}

export async function requireReportCenterSession(): Promise<AppSession | null> {
  const session = await getSession();
  return session && canAccessModule(session, "rapor-merkezi") ? session : null;
}

export async function requireReportTypeAccess(type: string | null): Promise<{ session: AppSession; def: ReportTypeDefinition } | null> {
  const session = await requireReportCenterSession();
  if (!session || !type) return null;
  const def = REPORT_TYPE_BY_KEY.get(type as ReportTypeKey);
  if (!def || !def.modules.some((module) => canAccessModule(session, module))) return null;
  return { session, def };
}

/** Owner lists (lead / müşteri names) are shown only to a user who can
 * open at least one report type for that owner kind. */
export function canListOwners(session: AppSession, ownerType: ReportOwnerType): boolean {
  return accessibleReportTypes(session).some((def) => def.owners.includes(ownerType));
}

export function unauthorized() {
  return NextResponse.json({ error: "Bu rapor türüne erişim yetkiniz yok." }, { status: 403 });
}

/** Never leaks internals: known errors keep their Turkish message, others
 * become a generic one (details stay in server logs). */
export function reportCenterErrorResponse(error: unknown, fallback = "Rapor işlemi tamamlanamadı.") {
  if (error instanceof ReportCenterError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Rapor Merkezi hatası:", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
