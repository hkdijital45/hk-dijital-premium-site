import { handleInstagramOAuthCallback } from "@/lib/social-autopilot/instagram-oauth";

// Registered as the exact redirect_uri in the Meta App Dashboard's Instagram
// Business Login product setup — see the "Meta App Setup" checklist in the
// delivery report for the literal URL to configure there.
export async function GET(request: Request) {
  return handleInstagramOAuthCallback(request);
}
