function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasValidBox(token) {
  const box = token?.bbox;
  return Boolean(
    box &&
      typeof box.x === "number" &&
      typeof box.y === "number" &&
      typeof box.w === "number" &&
      typeof box.h === "number" &&
      box.w > 0 &&
      box.h > 0
  );
}

function computeTextSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.7;

  let overlap = 0;
  const rightSet = new Set(right.split(""));
  for (const c of left) {
    if (rightSet.has(c)) overlap += 1;
  }
  return overlap / Math.max(left.length, right.length);
}

function pickNearestValueToken(labelField, labelToken, tokens) {
  if (!labelToken?.bbox) return null;
  const labelBox = labelToken.bbox;
  const labelCenterY = labelBox.y + labelBox.h / 2;
  const labelRightX = labelBox.x + labelBox.w;

  const safeTokens = Array.isArray(tokens) ? tokens : [];
  const usable = safeTokens.filter(
    (t) =>
      t !== labelToken &&
      typeof t?.text === "string" &&
      t.text.trim().length > 0 &&
      hasValidBox(t)
  );
  if (usable.length === 0) return null;

  let best = null;
  let bestScore = 0;
  const maxDx = Math.max(180, labelBox.w * 12);
  const lineTolerance = Math.max(20, labelBox.h * 1.5);

  for (const token of usable) {
    const box = token.bbox;
    const tokenCenterY = box.y + box.h / 2;
    const dx = box.x - labelRightX;
    const dy = Math.abs(tokenCenterY - labelCenterY);
    const textScore = computeTextSimilarity(labelField.label, token.text);

    // Skip obvious label-like neighbors when searching for value.
    if (textScore >= 0.7) continue;

    let score = 0;
    if (dx >= 0 && dx <= maxDx && dy <= lineTolerance) {
      score = 1.2 - dx / maxDx - dy / (lineTolerance * 2);
    } else if (box.y > labelBox.y && Math.abs(box.x - labelRightX) <= maxDx / 2) {
      const downDy = box.y - labelBox.y;
      score = 0.7 - downDy / (lineTolerance * 4);
    }
    if (score > bestScore) {
      bestScore = score;
      best = token;
    }
  }

  return bestScore > 0.12 ? best : null;
}

export function alignSemanticFieldsToTokens(fields, tokens, minScore = 0.3) {
  const safeFields = Array.isArray(fields) ? fields : [];
  const safeTokens = Array.isArray(tokens)
    ? tokens.filter(
        (token) =>
          token &&
          typeof token.text === "string" &&
          token.text.trim().length > 0 &&
          hasValidBox(token)
      )
    : [];

  return safeFields.map((field) => {
    let best = null;
    let bestScore = 0;

    for (const token of safeTokens) {
      const score = computeTextSimilarity(field.label, token.text);
      if (score > bestScore) {
        bestScore = score;
        best = token;
      }
    }

    if (!best || bestScore < minScore) {
      return {
        key: field.key,
        label: field.label,
        confidence: 0,
        matchedToken: null,
        matchedValueToken: null,
      };
    }

    const valueToken = pickNearestValueToken(field, best, safeTokens);
    return {
      key: field.key,
      label: field.label,
      confidence: Number(bestScore.toFixed(3)),
      matchedToken: best,
      matchedValueToken: valueToken,
    };
  });
}

export function applyAlignedBoxesToLayout(layout, mappings) {
  if (!layout || !Array.isArray(layout.fields)) return layout;
  const mappingByKey = new Map((mappings || []).map((m) => [m.key, m]));

  const nextFields = layout.fields.map((field) => {
    const mapping = mappingByKey.get(field.key);
    if (!mapping || !mapping.matchedToken?.bbox) return field;

    const box = mapping.matchedToken.bbox;
    const valueBox = mapping.matchedValueToken?.bbox
      ? mapping.matchedValueToken.bbox
      : {
          x: box.x + box.w + 8,
          y: box.y,
          w: Math.max(120, box.w * 1.8),
          h: box.h,
        };

    return {
      ...field,
      labelBox: box,
      valueBox,
      confidence: Math.max(field.confidence || 0, mapping.confidence),
    };
  });

  return {
    ...layout,
    fields: nextFields,
  };
}
