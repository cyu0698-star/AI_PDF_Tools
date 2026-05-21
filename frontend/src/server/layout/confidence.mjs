import { alignSemanticFieldsToTokens } from "./aligner.mjs";

function normalizeScore(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(3));
}

export function buildLowConfidenceFields({
  templateLayout,
  companyInfo,
  ocrTokens,
  threshold = 0.65,
}) {
  const fields = Array.isArray(templateLayout?.fields) ? templateLayout.fields : [];
  if (fields.length === 0) return [];

  const mappings = alignSemanticFieldsToTokens(fields, Array.isArray(ocrTokens) ? ocrTokens : [], 0);
  const mappingByKey = new Map(mappings.map((m) => [m.key, m]));

  const result = [];
  for (const field of fields) {
    const fieldConfidence = normalizeScore(field.confidence || 0);
    const mappingConfidence = normalizeScore(mappingByKey.get(field.key)?.confidence || 0);
    const value = (companyInfo?.[field.key] || "").toString().trim();
    const hasValue = value.length > 0;

    let score = Math.max(fieldConfidence, mappingConfidence);
    if (!hasValue) {
      score *= 0.6;
    }
    score = normalizeScore(score);

    if (score < threshold) {
      result.push({ key: field.key, confidence: score });
    }
  }

  return result;
}
