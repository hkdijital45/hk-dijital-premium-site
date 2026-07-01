import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GoogleIntegrationsPage() {
  redirect("/hk-admin/entegrasyon-merkezi?tab=google");
}
