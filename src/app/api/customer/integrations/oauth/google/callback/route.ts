import { oauthCallback } from "@/lib/customer-integration-oauth";

export async function GET(request: Request) {
  return oauthCallback("google", request);
}
