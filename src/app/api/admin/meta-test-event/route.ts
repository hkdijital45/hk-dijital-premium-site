import { POST as testConversionApi } from "../conversion-api-test/route";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return testConversionApi(new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
    body: JSON.stringify({ ...body, sendEvent: true })
  }));
}
