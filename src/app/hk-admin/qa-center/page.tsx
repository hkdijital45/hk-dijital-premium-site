import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function QaCenterPage() {
  if (!(await requireModuleAccess("qa-center"))) redirect("/hk-admin");
  redirect("/hk-admin/kontrol-merkezi?tab=qa");
}
