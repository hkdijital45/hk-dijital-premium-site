// Pure quota arithmetic, split out from quota.ts (which does real Supabase
// I/O) so it stays directly unit-testable with node's plain test runner —
// same split pattern as gemini-client.ts / gemini-client-core.ts.
export type QuotaStatus = {
  customerUsed: number;
  customerLimit: number;
  customerRemaining: number;
  globalUsed: number;
  globalLimit: number;
  globalRemaining: number;
  exceeded: boolean;
};

export function buildQuotaStatus(customerUsed: number, customerLimit: number, globalUsed: number, globalLimit: number): QuotaStatus {
  const customerRemaining = Math.max(0, customerLimit - customerUsed);
  const globalRemaining = Math.max(0, globalLimit - globalUsed);
  return {
    customerUsed, customerLimit, customerRemaining,
    globalUsed, globalLimit, globalRemaining,
    exceeded: customerRemaining <= 0 || globalRemaining <= 0
  };
}

// How many *new* Gemini requests a scan may make given remaining quota.
export function allowedQuestionCount(requested: number, quota: QuotaStatus): number {
  return Math.max(0, Math.min(requested, quota.customerRemaining, quota.globalRemaining));
}
