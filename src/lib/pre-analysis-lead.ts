// Maps the Dijital Pazarlama Ön Analizi form payload to the lead columns it
// needs: address reuses the existing leads.address column, and the three
// answers that have no column of their own go into one structured JSON value.
export type PreAnalysisLeadFields = {
  address: string;
  pre_analysis: { contentNeed: string; startTiming: string; socialStatus: string } | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function preAnalysisLeadFields(payload: Record<string, unknown>): PreAnalysisLeadFields {
  const contentNeed = clean(payload.contentNeed);
  const startTiming = clean(payload.urgency);
  const socialStatus = clean(payload.socialStatus);
  const hasAnswers = Boolean(contentNeed || startTiming || socialStatus);
  return {
    address: clean(payload.address).slice(0, 500),
    pre_analysis: hasAnswers ? { contentNeed, startTiming, socialStatus } : null
  };
}
