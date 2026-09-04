import { NextResponse } from "next/server";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const EVENT_NAMES = new Set(["PageView", "Contact", "Lead", "InitiateCheckout", "ViewContent", "HK_CTA_Click"]);
const SOURCES = new Set(["Direct", "Organic", "Facebook / Instagram", "Google", "Referral"]);

// Public, unauthenticated by design (every visitor's browser calls this),
// so it must never trust the client for anything beyond these three
// tightly-validated fields, and must never echo back internal detail on
// failure. No personal data is accepted or stored here.
const BOT_USER_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview|headlesschrome|lighthouse|pingdom|monitor/i;

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_USER_AGENT.test(userAgent)) return NextResponse.json({ ok: true, skipped: "bot" });
  if (!hasSupabaseConfig()) return NextResponse.json({ ok: true, skipped: "no_database" });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const eventName = text(body.event_name, 40);
  if (!EVENT_NAMES.has(eventName)) return NextResponse.json({ error: "Geçersiz olay adı" }, { status: 400 });

  const sessionId = text(body.session_id, 100);
  if (!sessionId) return NextResponse.json({ error: "Oturum kimliği eksik" }, { status: 400 });

  const pagePath = text(body.page_path, 300) || null;
  if (pagePath && !pagePath.startsWith("/")) return NextResponse.json({ error: "Geçersiz sayfa yolu" }, { status: 400 });

  const source = text(body.source, 40);
  const referrerSource = SOURCES.has(source) ? source : "Direct";

  try {
    await supabaseRest("website_analytics_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ event_name: eventName, page_path: pagePath, session_id: sessionId, referrer_source: referrerSource })
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Never surface DB detail to an unauthenticated public endpoint, and
    // never let an analytics failure look like a real error to the visitor.
    return NextResponse.json({ ok: true, skipped: "write_failed" });
  }
}
