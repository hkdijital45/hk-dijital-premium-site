import { oauthAccounts } from "@/lib/customer-integration-oauth";

export async function GET(request: Request) {
  return oauthAccounts(request);
}
