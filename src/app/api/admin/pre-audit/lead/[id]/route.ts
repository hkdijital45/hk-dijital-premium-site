import { NextResponse } from "next/server";
import { canAccessModule } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { getSafeSupabaseError } from "@/lib/supabase";
import { PRE_REVIEW_REJECTION_REASONS } from "@/lib/pre-audit/types";
import {
  startPreReviewQueue, markPreReviewInProgress, rejectPreReview, sendPreReviewToLeadPipeline, PreReviewLeadNotFoundError
} from "@/lib/pre-audit/reports";

// Admin-only lead pre-review queue actions ("Ön İncele" start, "İnceleniyor"
// marker, "İptal" with reason, "Teklif Gönder → Lead Merkezi"). Never
// exposed via MCP — these are human sales decisions, not something Claude
// performs. "Teklif Gönder → Müşteriler" instead calls the existing
// /api/admin/leads/[id]/convert route directly from the UI — reused as-is,
// not duplicated here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !(canAccessModule(session, "on-inceleme") || canAccessModule(session, "musteri-bulucu"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === "start_review") {
      const lead = await startPreReviewQueue(id);
      return NextResponse.json({ ok: true, lead });
    }
    if (action === "mark_in_progress") {
      await markPreReviewInProgress(id);
      return NextResponse.json({ ok: true });
    }
    if (action === "reject") {
      const reason = typeof body.reason === "string" ? body.reason : "";
      if (!PRE_REVIEW_REJECTION_REASONS.includes(reason as never)) {
        return NextResponse.json({ error: "Geçerli bir iptal sebebi seçin." }, { status: 400 });
      }
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (reason === "Diğer" && !note) {
        return NextResponse.json({ error: "'Diğer' seçildiğinde açıklama zorunludur." }, { status: 400 });
      }
      const lead = await rejectPreReview(id, reason, note, session.email || "bilinmeyen");
      return NextResponse.json({ ok: true, lead });
    }
    if (action === "send_offer_lead") {
      const lead = await sendPreReviewToLeadPipeline(id);
      return NextResponse.json({ ok: true, lead });
    }
    return NextResponse.json({ error: "Geçersiz aksiyon." }, { status: 400 });
  } catch (error) {
    if (error instanceof PreReviewLeadNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
