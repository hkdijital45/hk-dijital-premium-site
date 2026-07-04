import { selectOAuthAccount } from "@/lib/customer-integration-oauth";

export async function POST(request: Request) {
  return selectOAuthAccount(request);
}
