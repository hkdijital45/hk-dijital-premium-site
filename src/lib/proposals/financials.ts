// Deterministic proposal financial calculations — Teklif Motoru never
// trusts Claude-generated arithmetic for money (brief requirement).
// Reuses the project's existing VAT primitives (src/lib/packages.ts,
// already used by the real /api/admin/proposals/pdf route) instead of a
// second tax implementation.
import { calculateVat, calculateTotalWithVat, formatTRY, DEFAULT_VAT_RATE } from "@/lib/packages";
import { normalizeBusinessScope, normalizeServiceLines, type NormalizedServiceLine } from "@/lib/proposals/business-scope";

export type AdPlatformBudget = { platform: string; monthlyBudget: number };

export type ProposalFinancialsInput = {
  adBudgets: AdPlatformBudget[];
  agencyMonthlyFee: number;
  setupFee: number;
  additionalServiceFees?: number;
  contractMonths?: number | null;
  vatRate?: number;
  /** Optional per-business service lines (already normalized/deduped via
   * normalizeServiceLines). Added on top of the agency fee — never derived
   * from the number of businesses. */
  serviceLines?: NormalizedServiceLine[];
};

export type ProposalFinancialsResult = {
  totalMonthlyAdBudget: number;
  adBudgetsByPlatform: AdPlatformBudget[];
  vatRate: number;
  agencyMonthlyFeeExclVat: number;
  agencyMonthlyFeeInclVat: number;
  setupFeeExclVat: number;
  setupFeeInclVat: number;
  additionalServiceFeesExclVat: number;
  additionalServiceFeesInclVat: number;
  firstMonthTotalExclVat: number;
  firstMonthTotalInclVat: number;
  subsequentMonthTotalExclVat: number;
  subsequentMonthTotalInclVat: number;
  contractMonths: number | null;
  contractTotalExclVat: number | null;
  contractTotalInclVat: number | null;
  serviceLines: Array<NormalizedServiceLine & { monthlyFeeInclVat: number; setupFeeInclVat: number }>;
  serviceLinesMonthlyExclVat: number;
  serviceLinesMonthlyInclVat: number;
  serviceLinesSetupExclVat: number;
  serviceLinesSetupInclVat: number;
  formatted: {
    totalMonthlyAdBudget: string;
    agencyMonthlyFeeInclVat: string;
    setupFeeInclVat: string;
    firstMonthTotalInclVat: string;
    subsequentMonthTotalInclVat: string;
    contractTotalInclVat: string | null;
  };
};

/** Ad spend is pass-through platform budget (paid directly to Google/Meta,
 * never HK Dijital's own taxable revenue) — it is NEVER taxed here, only
 * the agency's own fees are. Matches the brief's own worked example
 * exactly: 12.000 (Google) + 8.000 (Meta) + 12.000 (fee) + 5.000 (setup)
 * = 37.000 first month; 20.000 + 12.000 = 32.000 subsequent month — both
 * "before applicable taxes", i.e. excl. VAT. */
export function calculateProposalFinancials(input: ProposalFinancialsInput): ProposalFinancialsResult {
  const vatRate = input.vatRate ?? DEFAULT_VAT_RATE;
  const adBudgetsByPlatform = (input.adBudgets || []).filter((b) => Number(b.monthlyBudget) > 0);
  const totalMonthlyAdBudget = adBudgetsByPlatform.reduce((sum, b) => sum + Number(b.monthlyBudget || 0), 0);

  const agencyFee = Number(input.agencyMonthlyFee || 0);
  const setupFee = Number(input.setupFee || 0);
  const additional = Number(input.additionalServiceFees || 0);

  const agencyMonthlyFeeInclVat = calculateTotalWithVat(agencyFee, vatRate);
  const setupFeeInclVat = calculateTotalWithVat(setupFee, vatRate);
  const additionalServiceFeesInclVat = calculateTotalWithVat(additional, vatRate);

  const serviceLines = (input.serviceLines || []).map((line) => ({
    ...line,
    monthlyFeeInclVat: calculateTotalWithVat(line.monthlyFee, vatRate),
    setupFeeInclVat: calculateTotalWithVat(line.setupFee, vatRate)
  }));
  const serviceLinesMonthlyExclVat = serviceLines.reduce((sum, line) => sum + line.monthlyFee, 0);
  const serviceLinesSetupExclVat = serviceLines.reduce((sum, line) => sum + line.setupFee, 0);
  const serviceLinesMonthlyInclVat = serviceLines.reduce((sum, line) => sum + line.monthlyFeeInclVat, 0);
  const serviceLinesSetupInclVat = serviceLines.reduce((sum, line) => sum + line.setupFeeInclVat, 0);

  const firstMonthTotalExclVat = totalMonthlyAdBudget + agencyFee + setupFee + additional + serviceLinesMonthlyExclVat + serviceLinesSetupExclVat;
  const firstMonthTotalInclVat = totalMonthlyAdBudget + agencyMonthlyFeeInclVat + setupFeeInclVat + additionalServiceFeesInclVat + serviceLinesMonthlyInclVat + serviceLinesSetupInclVat;
  const subsequentMonthTotalExclVat = totalMonthlyAdBudget + agencyFee + additional + serviceLinesMonthlyExclVat;
  const subsequentMonthTotalInclVat = totalMonthlyAdBudget + agencyMonthlyFeeInclVat + additionalServiceFeesInclVat + serviceLinesMonthlyInclVat;

  const contractMonths = input.contractMonths && input.contractMonths > 0 ? Math.round(input.contractMonths) : null;
  const contractTotalExclVat = contractMonths
    ? firstMonthTotalExclVat + subsequentMonthTotalExclVat * (contractMonths - 1)
    : null;
  const contractTotalInclVat = contractMonths
    ? firstMonthTotalInclVat + subsequentMonthTotalInclVat * (contractMonths - 1)
    : null;

  return {
    totalMonthlyAdBudget,
    adBudgetsByPlatform,
    vatRate,
    agencyMonthlyFeeExclVat: agencyFee,
    agencyMonthlyFeeInclVat,
    setupFeeExclVat: setupFee,
    setupFeeInclVat,
    additionalServiceFeesExclVat: additional,
    additionalServiceFeesInclVat,
    firstMonthTotalExclVat,
    firstMonthTotalInclVat,
    subsequentMonthTotalExclVat,
    subsequentMonthTotalInclVat,
    contractMonths,
    contractTotalExclVat,
    contractTotalInclVat,
    serviceLines,
    serviceLinesMonthlyExclVat,
    serviceLinesMonthlyInclVat,
    serviceLinesSetupExclVat,
    serviceLinesSetupInclVat,
    formatted: {
      totalMonthlyAdBudget: formatTRY(totalMonthlyAdBudget),
      agencyMonthlyFeeInclVat: formatTRY(agencyMonthlyFeeInclVat),
      setupFeeInclVat: formatTRY(setupFeeInclVat),
      firstMonthTotalInclVat: formatTRY(firstMonthTotalInclVat),
      subsequentMonthTotalInclVat: formatTRY(subsequentMonthTotalInclVat),
      contractTotalInclVat: contractTotalInclVat !== null ? formatTRY(contractTotalInclVat) : null
    }
  };
}

type QuestionnaireMoneyFields = {
  platforms?: string[];
  budget?: { googleAllocation?: number | null; metaAllocation?: number | null };
  fees?: { monthlyManagementFee?: number; setupFee?: number; contractDurationMonths?: number };
  businessScope?: unknown;
  businessServiceLines?: unknown;
};

/** The same deterministic calculation the proposal wizard shows, derived
 * only from the saved questionnaire — used server-side so the stored
 * financials (and therefore the PDF) never depend on client arithmetic. */
export function financialsFromQuestionnaire(q: QuestionnaireMoneyFields): ProposalFinancialsResult {
  const platforms = (q.platforms || []).filter((p) => p === "Google Ads" || p === "Meta Ads");
  const adBudgets = platforms.map((platform) => ({
    platform,
    monthlyBudget: platform === "Google Ads" ? Number(q.budget?.googleAllocation) || 0 : Number(q.budget?.metaAllocation) || 0
  }));
  const scope = normalizeBusinessScope(q.businessScope);
  return calculateProposalFinancials({
    adBudgets,
    agencyMonthlyFee: Number(q.fees?.monthlyManagementFee) || 0,
    setupFee: Number(q.fees?.setupFee) || 0,
    contractMonths: Number(q.fees?.contractDurationMonths) || 1,
    serviceLines: normalizeServiceLines(q.businessServiceLines, scope).lines
  });
}

export { calculateVat, formatTRY };
