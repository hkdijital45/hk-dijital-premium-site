import { oauthAssets } from "@/lib/customer-integration-oauth";

export async function GET(request: Request) {
  return oauthAssets("tiktok", request);
}
