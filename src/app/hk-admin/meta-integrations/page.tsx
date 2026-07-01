import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationsPage() {
  redirect("/hk-admin/entegrasyon-merkezi?tab=meta");
}
