import { ProposalBuilder } from "@/components/admin/Phase2OperatingSystem";
import { getAdminPageData } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function ProposalBuilderPage() {
  await getAdminPageData();
  return <ProposalBuilder />;
}
