// Deterministic proposal financial calculations — Teklif Motoru never
// trusts Claude-generated arithmetic for money (brief requirement).
// Reuses the project's existing VAT primitives (src/lib/packages.ts,
// already used by the real /api/admin/proposals/pdf route) instead of a
// second tax implementation.
import { calculateVat, calculateTotalWithVat, formatTRY, DEFAULT_VAT_RATE } from "@/lib/packages";

export type AdPlatformBudget = { platform: string; monthlyBudget: number };

export type ProposalFinancialsInput = {
  adBudgets: AdPlatformBudget[];
  agencyMonthlyFee: number;
  setupFee: number;
  additionalServiceFees?: number;
  contractMonths?: number | null;
  vatRate?: number;
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

  const firstMonthTotalExclVat = totalMonthlyAdBudget + agencyFee + setupFee + additional;
  const firstMonthTotalInclVat = totalMonthlyAdBudget + agencyMonthlyFeeInclVat + setupFeeInclVat + additionalServiceFeesInclVat;
  const subsequentMonthTotalExclVat = totalMonthlyAdBudget + agencyFee + additional;
  const subsequentMonthTotalInclVat = totalMonthlyAdBudget + agencyMonthlyFeeInclVat + additionalServiceFeesInclVat;

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

export { calculateVat, formatTRY };
