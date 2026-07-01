import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentHubPage() {
  if (!(await requireModuleAccess("agent-hub"))) redirect("/hk-admin");
  redirect("/hk-admin/ai-otomasyon?tab=agent-hub");
}
