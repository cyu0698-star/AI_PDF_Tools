function toFiniteNumber(value, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value;
}

export function assessLayoutQuality(layout, thresholds = {}) {
  const minOcrTokens = toFiniteNumber(thresholds.minOcrTokens, 8);
  const minAnchorRate = toFiniteNumber(thresholds.minAnchorRate, 0.6);
  const minConfidence = toFiniteNumber(thresholds.minConfidence, 0.45);

  const fields = Array.isArray(layout?.fields) ? layout.fields : [];
  const totalFields = fields.length;
  const anchoredFields = fields.filter(
    (f) => Boolean(f?.labelBox) && Boolean(f?.valueBox)
  ).length;
  const anchorRate =
    totalFields > 0 ? Number((anchoredFields / totalFields).toFixed(3)) : 0;
  const ocrTokenCount = toFiniteNumber(layout?.ocrTokenCount, 0);
  const confidence = toFiniteNumber(layout?.confidence, 0);

  const failures = [];
  if (ocrTokenCount < minOcrTokens) {
    failures.push(
      `ocr_token_count_too_low:${ocrTokenCount}<${minOcrTokens}`
    );
  }
  if (totalFields > 0 && anchorRate < minAnchorRate) {
    failures.push(`anchor_rate_too_low:${anchorRate}<${minAnchorRate}`);
  }
  if (totalFields > 0 && confidence < minConfidence) {
    failures.push(`layout_confidence_too_low:${confidence}<${minConfidence}`);
  }

  return {
    isQualified: failures.length === 0,
    ocrTokenCount,
    totalFields,
    anchoredFields,
    anchorRate,
    confidence,
    thresholds: {
      minOcrTokens,
      minAnchorRate,
      minConfidence,
    },
    failures,
  };
}

export function buildLayoutDiagnostics(layout, quality) {
  const warnings = Array.isArray(layout?.warnings) ? layout.warnings : [];
  const failures = Array.isArray(quality?.failures) ? quality.failures : [];
  const sourceType = layout?.sourceType || "unknown";
  const pipeline = layout?.meta?.pipeline || "unknown";
  const ocrProvider = layout?.meta?.ocrProvider || "unknown";
  const tokenSource = layout?.meta?.tokenSource || "unknown";

  let primaryIssue = "ok";
  if (failures.length > 0) {
    if (failures.some((f) => f.startsWith("ocr_token_count_too_low"))) {
      primaryIssue = "ocr_tokens_insufficient";
    } else if (failures.some((f) => f.startsWith("anchor_rate_too_low"))) {
      primaryIssue = "anchor_rate_low";
    } else if (failures.some((f) => f.startsWith("layout_confidence_too_low"))) {
      primaryIssue = "layout_confidence_low";
    } else {
      primaryIssue = "quality_gate_failed";
    }
  } else if (warnings.length > 0) {
    primaryIssue = warnings[0];
  }

  return {
    sourceType,
    pipeline,
    ocrProvider,
    tokenSource,
    warnings,
    failures,
    primaryIssue,
  };
}
