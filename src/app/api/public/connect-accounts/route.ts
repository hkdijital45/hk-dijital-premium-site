import { connectLinkAccounts } from "@/lib/customer-integration-oauth";

// Public, sessionless — authorization is the connectToken query param
// itself (validated server-side against customer_connect_tokens inside
// connectLinkAccounts). Never trusts a client-supplied company id.
export async function GET(request: Request) {
  return connectLinkAccounts(request);
}
