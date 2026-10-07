// Aday Değerlendirme (Candidate Evaluation) — shared types/constants. See
// supabase/migrations/20261008_candidate_evaluations.sql for the table
// this mirrors. Deliberately a SEPARATE report family from Ön İnceleme
// (pre_audit_reports/pre-audit/types.ts) — never collapsed into it.

export const CANDIDATE_EVALUATION_TABLE = "candidate_evaluations";

export type CandidateEvaluationReport = {
  id: string;
  company_id: string | null;
  lead_id: string | null;
  title: string;
  report_date: string;

  recommendation: string;
  priority: string;
  score: number | null;
  strengths: string[];
  weaknesses: string[];
  digital_opportunities: string[];
  suggested_next_action: string;
  report_content: string;
  sources: unknown;

  created_at: string;
  updated_at: string;
};

export type CandidateEvaluationListItem = Pick<
  CandidateEvaluationReport,
  "id" | "company_id" | "lead_id" | "title" | "report_date" | "recommendation" | "priority" | "score" | "created_at" | "updated_at"
>;
