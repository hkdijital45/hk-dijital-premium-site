import { connectLinkSelectAccount } from "@/lib/customer-integration-oauth";

// Public, sessionless — authorization is the connectToken in the body
// (validated server-side). Every submitted asset is re-verified against a
// fresh real provider discovery call before anything is persisted — see
// connectLinkSelectAccount.
export async function POST(request: Request) {
  return connectLinkSelectAccount(request);
}
