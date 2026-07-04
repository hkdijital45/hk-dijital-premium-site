import { oauthConnect } from "@/lib/customer-integration-oauth";

export async function GET(request: Request) {
  return oauthConnect("google", request);
}
