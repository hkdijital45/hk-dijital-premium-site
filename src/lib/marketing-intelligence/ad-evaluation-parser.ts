// Parses Claude's pasted evaluation response (via the delimited format
// ad-evaluation-prompt.ts asks for) into internal/client report sections
// + a structured decision — never throws, never crashes the UI. A
// malformed/truncated paste still returns a safe, inspectable result
// (empty reports, ok: false, warnings) so the caller can show the user
// what went wrong and still let them save the raw text.
import { EVALUATION_DELIMITERS } from "./ad-evaluation-prompt";
import { AD_EVALUATION_DECISIONS, type AdEvaluationDecision, type EvaluationReportSection, type EvaluationReportText } from "./ad-evaluations";

export type ParsedEvaluation = {
  ok: boolean;
  internalReport: EvaluationReportText;
  clientReport: EvaluationReportText;
  decision: AdEvaluationDecision | null;
  nextReviewAt: string | null;
  nextReviewNote: string | null;
  warnings: string[];
};

function extractBetween(text: string, startMarker: string, endMarker: string): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = text.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) return null;
  return text.slice(startIdx + startMarker.length, endIdx).trim();
}

// Splits "## Heading\ncontent...\n## Next Heading\n..." into sections;
// any text before the first heading becomes the executive summary.
function parseMarkdownSections(markdown: string | null): EvaluationReportText {
  if (!markdown || !markdown.trim()) return {};
  const lines = markdown.split(/\r?\n/);
  const headingRe = /^#{1,3}\s+(.+?)\s*$/;
  const sections: EvaluationReportSection[] = [];
  let current: EvaluationReportSection | null = null;
  const preambleLines: string[] = [];
  for (const line of lines) {
    const match = line.match(headingRe);
    if (match) {
      if (current) sections.push({ ...current, content: current.content.trim() });
      current = { title: match[1].replace(/^\d+[.)]\s*/, "").trim(), content: "" };
    } else if (current) {
      current.content += `${line}\n`;
    } else {
      preambleLines.push(line);
    }
  }
  if (current) sections.push({ ...current, content: current.content.trim() });
  const executiveSummary = preambleLines.join("\n").trim();
  return { executiveSummary: executiveSummary || undefined, sections: sections.filter((s) => s.title && s.content) };
}

function parseDecisionBlock(raw: string | null): { decision: AdEvaluationDecision | null; nextReviewAt: string | null; nextReviewNote: string | null } {
  if (!raw) return { decision: null, nextReviewAt: null, nextReviewNote: null };
  const decisionMatch = raw.match(new RegExp(`${EVALUATION_DELIMITERS.decision}\\s*\\n\\s*([A-Z_]+)`));
  const rawDecision = decisionMatch?.[1]?.trim() || "";
  const decision = (AD_EVALUATION_DECISIONS as readonly string[]).includes(rawDecision) ? (rawDecision as AdEvaluationDecision) : null;
  const reviewMatch = raw.match(new RegExp(`${EVALUATION_DELIMITERS.nextReview}\\s*\\n\\s*(.+)`));
  const reviewLine = reviewMatch?.[1]?.trim() || "";
  const [datePart, ...noteParts] = reviewLine.split("|");
  const dateCandidate = (datePart || "").trim();
  const nextReviewAt = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate) ? dateCandidate : null;
  const nextReviewNote = noteParts.join("|").trim() || null;
  return { decision, nextReviewAt, nextReviewNote };
}

export function parseAdEvaluationResponse(rawResponse: string): ParsedEvaluation {
  const warnings: string[] = [];
  const text = typeof rawResponse === "string" ? rawResponse : "";
  const internalRaw = extractBetween(text, EVALUATION_DELIMITERS.internalStart, EVALUATION_DELIMITERS.internalEnd);
  const clientRaw = extractBetween(text, EVALUATION_DELIMITERS.clientStart, EVALUATION_DELIMITERS.clientEnd);
  if (!internalRaw) warnings.push("Dahili rapor bloğu bulunamadı (===INTERNAL_REPORT_START/END=== işaretleri eksik veya hasarlı).");
  if (!clientRaw) warnings.push("Müşteri raporu bloğu bulunamadı (===CLIENT_REPORT_START/END=== işaretleri eksik veya hasarlı).");

  const tail = text.slice(text.indexOf(EVALUATION_DELIMITERS.decision) >= 0 ? text.indexOf(EVALUATION_DELIMITERS.decision) : text.length);
  const { decision, nextReviewAt, nextReviewNote } = parseDecisionBlock(tail);
  if (!decision) warnings.push("Geçerli bir karar (===DECISION===) bulunamadı — karar daha sonra elle seçilebilir.");

  return {
    ok: Boolean(internalRaw && clientRaw),
    internalReport: parseMarkdownSections(internalRaw),
    clientReport: parseMarkdownSections(clientRaw),
    decision,
    nextReviewAt,
    nextReviewNote,
    warnings
  };
}
