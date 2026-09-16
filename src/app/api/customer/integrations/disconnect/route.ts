import { disconnectIntegrationAsset } from "@/lib/customer-integration-oauth";

export async function POST(request: Request) {
  return disconnectIntegrationAsset(request);
}
