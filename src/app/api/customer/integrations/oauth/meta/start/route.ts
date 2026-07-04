import { oauthStart } from "@/lib/customer-integration-oauth";

export async function GET(request: Request) {
  return oauthStart("meta", request);
}
