import { startInstagramOAuth } from "@/lib/social-autopilot/instagram-oauth";

export async function GET(request: Request) {
  return startInstagramOAuth(request);
}
