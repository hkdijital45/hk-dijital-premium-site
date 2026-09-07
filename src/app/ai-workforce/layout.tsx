import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/permissions";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

export const dynamic = "force-dynamic";

export default async function AiWorkforceLayout({ children }: { children: ReactNode }) {
  if (!(await requireModuleAccess(AI_WORKFORCE_MODULE))) redirect("/hk-admin");
  return children;
}
