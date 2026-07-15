export type StructuredParseResult = {
  value: Record<string, unknown>;
  warnings: string[];
};

type ParseOptions = {
  expectedFields?: string[];
  arrayFieldName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExpectedField(value: Record<string, unknown>, expectedFields: string[]) {
  if (!expectedFields.length) return true;
  return expectedFields.some((field) => field in value);
}

function unwrapProviderEnvelope(value: unknown, expectedFields: string[], warnings: string[]): unknown {
  let current = value;
  const envelopeKeys = ["data", "result", "output", "content", "response"];
  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current)) return current;
    const record = current;
    if (hasExpectedField(record, expectedFields)) return record;
    const key = envelopeKeys.find((candidate) => isRecord(record[candidate]) && hasExpectedField(record[candidate] as Record<string, unknown>, expectedFields));
    if (!key) return current;
    warnings.push(`Provider envelope "${key}" açıldı.`);
    current = record[key];
  }
  return current;
}

function parseJson(text: string) {
  return JSON.parse(text) as unknown;
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const fullFence = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  return fullFence?.[1]?.trim() || trimmed;
}

function fencedBlocks(text: string) {
  return [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((match) => match[1].trim()).filter(Boolean);
}

function extractBalanced(text: string, openChar: "{" | "[", closeChar: "}" | "]") {
  const candidates: string[] = [];
  for (let start = text.indexOf(openChar); start >= 0; start = text.indexOf(openChar, start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === openChar) depth += 1;
      if (char === closeChar) depth -= 1;
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1));
        break;
      }
    }
  }
  return candidates;
}

function parseCandidate(candidate: string): unknown | null {
  const cleaned = stripCodeFence(candidate);
  try {
    return parseJson(cleaned);
  } catch {
    return null;
  }
}

export function parseStructuredAiResponse(input: unknown, options: ParseOptions = {}): StructuredParseResult {
  const warnings: string[] = [];
  const expectedFields = options.expectedFields || [];
  const arrayFieldName = options.arrayFieldName || "items";

  if (isRecord(input)) {
    const unwrapped = unwrapProviderEnvelope(input, expectedFields, warnings);
    if (isRecord(unwrapped)) return { value: unwrapped, warnings };
    if (Array.isArray(unwrapped)) return { value: { [arrayFieldName]: unwrapped }, warnings };
  }

  if (typeof input !== "string") {
    throw new Error("AI yanıtı beklenen yapıda oluşturulamadı. Sağlayıcı yanıtı eksik veya geçersizdi. Tekrar deneyin ya da başka bir sağlayıcı seçin.");
  }

  const text = input.trim();
  if (!text) {
    throw new Error("AI yanıtı beklenen yapıda oluşturulamadı. Sağlayıcı boş yanıt döndürdü. Tekrar deneyin ya da başka bir sağlayıcı seçin.");
  }

  const candidates = [
    text,
    stripCodeFence(text),
    ...fencedBlocks(text),
    ...extractBalanced(text, "{", "}"),
    ...extractBalanced(text, "[", "]")
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const parsed = parseCandidate(key);
    if (parsed === null) continue;
    const unwrapped = unwrapProviderEnvelope(parsed, expectedFields, warnings);
    if (isRecord(unwrapped)) return { value: unwrapped, warnings };
    if (Array.isArray(unwrapped)) return { value: { [arrayFieldName]: unwrapped }, warnings };
  }

  warnings.push(`AI yanıtı ayrıştırılamadı. Uzunluk: ${text.length} karakter.`);
  throw new Error("AI yanıtı beklenen yapıda oluşturulamadı. Sağlayıcı yanıtı eksik veya geçersizdi. Tekrar deneyin ya da başka bir sağlayıcı seçin.");
}
