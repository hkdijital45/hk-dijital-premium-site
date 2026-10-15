import "server-only";

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { BusinessLogoError } from "@/lib/business-logos";
import { LogoImageError } from "@/lib/server/logo-image";
import { SafeFetchError } from "@/lib/server/safe-fetch";
import type { LogoOwner } from "@/lib/business-logos-shared";

// Shared auth/parsing/error mapping for the /api/admin/business-logos routes.
export async function requireLogoAccess() {
  for (const moduleName of ["crm", "leads", "musteriler", "ad-insights", "on-inceleme", "teklifler"]) {
    const session = await requireModuleAccess(moduleName);
    if (session) return session;
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOwner(type: unknown, id: unknown): LogoOwner | null {
  if ((type !== "lead" && type !== "company" && type !== "unit") || typeof id !== "string" || !UUID.test(id)) return null;
  return { type, id };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function logoErrorResponse(error: unknown) {
  if (error instanceof LogoImageError || error instanceof SafeFetchError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof BusinessLogoError) return NextResponse.json({ error: error.message }, { status: 404 });
  const message = error instanceof Error ? error.message : "";
  if (message.includes("PGRST205") || message.includes("42P01")) return NextResponse.json({ error: "Logo tablosu henüz oluşturulmadı (veritabanı migration'ı bekleniyor)." }, { status: 503 });
  if (message.includes("23505")) return NextResponse.json({ error: "Bu logo zaten kayıtlı." }, { status: 409 });
  return NextResponse.json({ error: "Logo işlemi tamamlanamadı." }, { status: 500 });
}
