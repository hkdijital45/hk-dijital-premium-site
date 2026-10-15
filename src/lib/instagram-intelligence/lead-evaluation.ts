import "server-only";

// Instagram Değerlendirme for a registered CRM lead (a prospect, not yet an
// existing customer) — the direct-MCP-save counterpart to HK Admin's own
// "+ Manuel Değerlendirme" button for the `instagram` module (see
// AdInsightsCenter.tsx's "Kayıtlı Lead" target mode and
// ManualEvaluationSection.tsx). Deliberately reuses the SAME
// manual_evaluations table and field schema (INSTAGRAM_GROUPS in
// manual-evaluations-shared.ts) instead of a new table, so a row saved
// here and a row saved by hand through HK Admin show up in the exact same
// history list with no second source of truth.
//
// Distinct from get_instagram_profile_audit_context/
// save_instagram_profile_audit (that pair is post-sale profile-quality
// consulting for an EXISTING customer's own OAuth-connected Instagram
// account, backed by instagram_profile_audits) — a lead has no connected
// account, so only publicly observable Instagram/web research applies
// here; private Insights-only metrics (reach, impressions, profile
// visits, messages, leads, sales, revenue, story views) must never be
// fabricated for a lead and are always reported as unavailable.
import { supabaseRest } from "@/lib/supabase";
import {
  listManualEvaluations,
  getManualEvaluation,
  createManualEvaluation,
  updateManualEvaluation,
  ManualEvaluationNotFoundError,
  type ManualEvaluationRecord
} from "@/lib/manual-evaluations";
import { validateManualEvaluationInput, ManualEvaluationValidationError } from "@/lib/manual-evaluations-shared";
import { assertUnitLinkedTo, getBusinessUnit, listLinkedBusinesses, BusinessRelationshipNotFoundError } from "@/lib/business-relationships";
import { BusinessRelationshipValidationError } from "@/lib/business-relationships-shared";

export { ManualEvaluationValidationError as LeadInstagramEvaluationValidationError };
export class LeadInstagramEvaluationNotFoundError extends Error {}

type LeadRow = {
  id: string;
  company: string | null;
  name: string | null;
  business_type: string | null;
  city: string | null;
  district: string | null;
  website: string | null;
  instagram: string | null;
  status: string | null;
  company_id: string | null;
};

export type LeadInstagramEvaluationContext =
  | {
      status: "resolved";
      lead: {
        id: string;
        businessName: string;
        instagramUsername: string | null;
        instagramUrl: string | null;
        sector: string | null;
        city: string | null;
        district: string | null;
        website: string | null;
        isExistingCustomer: boolean;
      };
      dataAvailability: { publicSources: string[]; neverFabricate: string[] };
      existingEvaluation: { id: string; title: string; status: "draft" | "submitted"; createdAt: string } | null;
      /** İşletme ve Şube Yönetimi: branches/related brands linked to this lead. Empty when none. */
      relatedBusinesses: Array<{ businessUnitId: string | null; linkedLeadId: string | null; linkedCompanyId: string | null; relationship: string; name: string; instagram: string | null; website: string | null }>;
      /** Set when businessUnitId was passed: the exact business this evaluation is about (NOT the main lead business). */
      selectedBusiness: { businessUnitId: string; name: string; instagramUsername: string | null; instagramUrl: string | null; website: string | null; phone: string | null; address: string | null; description: string | null } | null;
    }
  | { status: "not_found" };

function instagramUrlFromUsername(instagram: string | null): string | null {
  if (!instagram) return null;
  const handle = instagram.trim().replace(/^@/, "");
  if (!handle) return null;
  if (/^https?:\/\//i.test(instagram)) return instagram;
  return `https://instagram.com/${handle}`;
}

async function linkedBusinessesSafe(leadId: string) {
  // Additive context only — if the business_relationships migration is not
  // applied yet, the original context must still be returned unchanged.
  try {
    return await listLinkedBusinesses({ type: "lead", id: leadId });
  } catch {
    return [];
  }
}

function toUnitError(error: unknown): never {
  if (error instanceof BusinessRelationshipNotFoundError) throw new LeadInstagramEvaluationNotFoundError(error.message);
  if (error instanceof BusinessRelationshipValidationError) throw new ManualEvaluationValidationError(error.message);
  throw error;
}

export async function getLeadInstagramEvaluationContext(leadId: string, businessUnitId?: string): Promise<LeadInstagramEvaluationContext> {
  const leads = await supabaseRest<LeadRow[]>(
    `leads?select=id,company,name,business_type,city,district,website,instagram,status,company_id&id=eq.${encodeURIComponent(leadId)}&deleted_at=is.null&limit=1`
  );
  const lead = leads[0];
  if (!lead) return { status: "not_found" };

  let selectedBusiness: Extract<LeadInstagramEvaluationContext, { status: "resolved" }>["selectedBusiness"] = null;
  if (businessUnitId) {
    try {
      await assertUnitLinkedTo(businessUnitId, { type: "lead", id: lead.id });
      const unit = await getBusinessUnit(businessUnitId);
      selectedBusiness = { businessUnitId: unit.id, name: unit.name, instagramUsername: unit.instagram, instagramUrl: instagramUrlFromUsername(unit.instagram), website: unit.website, phone: unit.phone, address: unit.address, description: unit.description };
    } catch (error) {
      if (error instanceof BusinessRelationshipNotFoundError || error instanceof BusinessRelationshipValidationError) return { status: "not_found" };
      throw error;
    }
  }

  const history = await listManualEvaluations("instagram", { leadId: lead.id, businessUnitId: businessUnitId || undefined, limit: 1 });
  const latest = history[0];
  const linked = await linkedBusinessesSafe(lead.id);

  return {
    status: "resolved",
    lead: {
      id: lead.id,
      businessName: lead.company || lead.name || "İsimsiz lead",
      instagramUsername: lead.instagram || null,
      instagramUrl: instagramUrlFromUsername(lead.instagram),
      sector: lead.business_type || null,
      city: lead.city || null,
      district: lead.district || null,
      website: lead.website || null,
      isExistingCustomer: Boolean(lead.company_id)
    },
    dataAvailability: {
      publicSources: [
        "Herkese açık Instagram profili: biyografi, kullanıcı adı, ad alanı, bağlantı/CTA, görünür gönderi/reels/story sayısı, görsel tutarlılık, sabitlenmiş gönderiler, öne çıkanlar.",
        "Herkese açık web sitesi ve Google/harita varlığı."
      ],
      neverFabricate: [
        "Erişim, gösterim, profil ziyareti, takipçi büyüme oranı, mesaj, lead, satış, gelir, hikaye görüntülenmesi gibi Instagram Insights (özel) verileri — bu lead için bağlı/OAuth'lu bir Instagram hesabı yok. Bu alanları tahmini sayıyla doldurma; boş bırak veya notlarda \"Veri mevcut değil\" olarak işaretle."
      ]
    },
    existingEvaluation: latest ? { id: latest.id, title: latest.title, status: latest.status, createdAt: latest.created_at } : null,
    relatedBusinesses: linked.map((item) => ({
      businessUnitId: item.entity.type === "unit" ? item.entity.id : null,
      linkedLeadId: item.entity.type === "lead" ? item.entity.id : null,
      linkedCompanyId: item.entity.type === "company" ? item.entity.id : null,
      relationship: item.direction === "parent" ? `parent:${item.relationshipType}` : item.relationshipType,
      name: item.name,
      instagram: item.instagram,
      website: item.website
    })),
    selectedBusiness
  };
}

export type SaveLeadInstagramEvaluationInput = {
  leadId: string;
  /** Optional: attribute this evaluation to a branch/related brand linked to the lead. */
  businessUnitId?: string;
  evaluationId?: string;
  title?: string;
  status?: "draft" | "submitted";
  data?: Record<string, unknown>;
  notes?: string;
  reportText?: string;
};

/** Explicit-approval-only save — called only after the user tells Claude to
 * save/record the evaluation, never after analysis alone (same rule as
 * every other write tool in this connector). Insert-only by default (a
 * genuinely new evaluation always becomes a new history row, mirroring
 * save_instagram_profile_audit's "never overwrites" convention); passing
 * evaluationId updates that exact row in place instead, for an explicit
 * "bu değerlendirmeyi güncelle" — and only ever the row this same leadId
 * already owns, never a different lead's or a different module's row. */
export async function saveLeadInstagramEvaluation(input: SaveLeadInstagramEvaluationInput): Promise<ManualEvaluationRecord> {
  if (!input.leadId) throw new ManualEvaluationValidationError("leadId zorunludur.");

  const data = input.data && typeof input.data === "object" ? input.data : {};
  const validationError = validateManualEvaluationInput("instagram", data);
  if (validationError) throw new ManualEvaluationValidationError(validationError);

  const leads = await supabaseRest<Array<{ id: string }>>(`leads?select=id&id=eq.${encodeURIComponent(input.leadId)}&deleted_at=is.null&limit=1`);
  if (!leads.length) throw new LeadInstagramEvaluationNotFoundError(`leadId doğrulanamadı: ${input.leadId} public.leads içinde bulunamadı.`);
  if (input.businessUnitId) await assertUnitLinkedTo(input.businessUnitId, { type: "lead", id: input.leadId }).catch(toUnitError);

  const claudeImportText = input.reportText || input.notes || "";

  if (input.evaluationId) {
    let existing: ManualEvaluationRecord;
    try {
      existing = await getManualEvaluation(input.evaluationId);
    } catch (error) {
      if (error instanceof ManualEvaluationNotFoundError) throw new LeadInstagramEvaluationNotFoundError("evaluationId bulunamadı.");
      throw error;
    }
    if (existing.module !== "instagram" || existing.lead_id !== input.leadId || (existing.business_unit_id || null) !== (input.businessUnitId || null)) {
      throw new LeadInstagramEvaluationNotFoundError("evaluationId bu leadId'ye ait bir Instagram Değerlendirmesi değil.");
    }
    return updateManualEvaluation(input.evaluationId, {
      title: input.title,
      status: input.status,
      data,
      notes: input.notes,
      claudeImportText: claudeImportText || undefined
    });
  }

  return createManualEvaluation({
    module: "instagram",
    leadId: input.leadId,
    businessUnitId: input.businessUnitId || null,
    targetLabel: String(data.businessName || ""),
    title: input.title || "",
    status: input.status || "submitted",
    data,
    notes: input.notes || "",
    source: "claude_import",
    claudeImportText: claudeImportText || undefined
  });
}
