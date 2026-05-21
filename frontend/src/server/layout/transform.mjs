function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasValidBox(box) {
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

function tokenCenter(token) {
  return {
    x: token.bbox.x + token.bbox.w / 2,
    y: token.bbox.y + token.bbox.h / 2,
  };
}

function textSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;

  let overlap = 0;
  const rightSet = new Set(right.split(""));
  for (const c of left) {
    if (rightSet.has(c)) overlap += 1;
  }
  return overlap / Math.max(left.length, right.length);
}

function solveLinearSystem6(A, b) {
  const n = 6;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];
    const div = M[col][col];
    for (let k = col; k <= n; k += 1) M[col][k] /= div;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }
  return M.map((row) => row[n]);
}

function estimateAffineFrom3Pairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 3) return null;
  const A = [];
  const b = [];
  for (let i = 0; i < 3; i += 1) {
    const src = pairs[i].src;
    const dst = pairs[i].dst;
    A.push([src.x, src.y, 1, 0, 0, 0]);
    b.push(dst.x);
    A.push([0, 0, 0, src.x, src.y, 1]);
    b.push(dst.y);
  }
  const solved = solveLinearSystem6(A, b);
  if (!solved) return null;
  return [
    [solved[0], solved[1], solved[2]],
    [solved[3], solved[4], solved[5]],
  ];
}

function estimateScaleTranslateFrom2Pairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2) return null;
  const [a, b] = pairs;
  const dxSrc = b.src.x - a.src.x;
  const dySrc = b.src.y - a.src.y;
  const dxDst = b.dst.x - a.dst.x;
  const dyDst = b.dst.y - a.dst.y;

  const sx = Math.abs(dxSrc) > 1e-6 ? dxDst / dxSrc : 1;
  const sy = Math.abs(dySrc) > 1e-6 ? dyDst / dySrc : 1;

  const safeSx = Number.isFinite(sx) && Math.abs(sx) > 1e-6 ? sx : 1;
  const safeSy = Number.isFinite(sy) && Math.abs(sy) > 1e-6 ? sy : 1;

  const tx = a.dst.x - safeSx * a.src.x;
  const ty = a.dst.y - safeSy * a.src.y;

  return [
    [safeSx, 0, tx],
    [0, safeSy, ty],
  ];
}

function applyToPoint(matrix, point) {
  return {
    x: matrix[0][0] * point.x + matrix[0][1] * point.y + matrix[0][2],
    y: matrix[1][0] * point.x + matrix[1][1] * point.y + matrix[1][2],
  };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function combinations3(items) {
  const out = [];
  for (let i = 0; i < items.length - 2; i += 1) {
    for (let j = i + 1; j < items.length - 1; j += 1) {
      for (let k = j + 1; k < items.length; k += 1) {
        out.push([items[i], items[j], items[k]]);
      }
    }
  }
  return out;
}

function extractTemplateAnchors(templateLayout) {
  const tokens = Array.isArray(templateLayout?.tokens) ? templateLayout.tokens : [];
  return tokens
    .filter((token) => {
      if (!token || typeof token.text !== "string" || !hasValidBox(token.bbox)) return false;
      if (!(token.role === "fixed_text" || token.role === "table_header")) return false;
      const t = token.text.trim();
      if (!t || t.length > 24) return false;
      if (/^[-+]?[\d,.]+$/.test(t)) return false;
      return true;
    })
    .map((token) => ({ id: token.id, text: token.text.trim(), bbox: token.bbox, center: tokenCenter(token) }));
}

function extractDocumentTokens(docTokens) {
  const safe = Array.isArray(docTokens) ? docTokens : [];
  return safe
    .filter((token) => token && typeof token.text === "string" && token.text.trim() && hasValidBox(token.bbox))
    .map((token, index) => ({
      id: token.id || `doc_${index + 1}`,
      text: token.text.trim(),
      bbox: token.bbox,
      center: tokenCenter(token),
    }));
}

function matchAnchors(templateAnchors, docTokens, threshold = 0.72) {
  const used = new Set();
  const matches = [];
  for (const anchor of templateAnchors) {
    let best = null;
    let bestScore = 0;
    for (const token of docTokens) {
      if (used.has(token.id)) continue;
      const score = textSimilarity(anchor.text, token.text);
      if (score > bestScore) {
        bestScore = score;
        best = token;
      }
    }
    if (best && bestScore >= threshold) {
      used.add(best.id);
      matches.push({
        templateId: anchor.id,
        templateText: anchor.text,
        docId: best.id,
        docText: best.text,
        similarity: Number(bestScore.toFixed(3)),
        src: anchor.center,
        dst: best.center,
      });
    }
  }
  return matches;
}

function evaluateMatrix(matrix, matches, inlierThresholdPx) {
  let inliers = 0;
  const errors = [];
  for (const m of matches) {
    const projected = applyToPoint(matrix, m.src);
    const err = pointDistance(projected, m.dst);
    errors.push(err);
    if (err <= inlierThresholdPx) inliers += 1;
  }
  const meanError = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : Number.POSITIVE_INFINITY;
  return {
    inliers,
    total: matches.length,
    inlierRatio: matches.length > 0 ? inliers / matches.length : 0,
    meanError,
  };
}

export function estimateTemplateTransform(templateLayout, docTokens, options = {}) {
  const inlierThresholdPx = typeof options.inlierThresholdPx === "number" ? options.inlierThresholdPx : 18;
  const minMatches = typeof options.minMatches === "number" ? options.minMatches : 2;
  const templateAnchors = extractTemplateAnchors(templateLayout);
  const documentTokens = extractDocumentTokens(docTokens);

  if (templateAnchors.length === 0) {
    return {
      ok: false,
      failureCode: "no_template_anchors",
      matrix: null,
      matchedAnchors: [],
      metrics: { inlierRatio: 0, reprojectionErrorPx: Number.POSITIVE_INFINITY, matchCount: 0, inlierCount: 0 },
    };
  }

  if (documentTokens.length === 0) {
    return {
      ok: false,
      failureCode: "no_document_tokens",
      matrix: null,
      matchedAnchors: [],
      metrics: { inlierRatio: 0, reprojectionErrorPx: Number.POSITIVE_INFINITY, matchCount: 0, inlierCount: 0 },
    };
  }

  const matches = matchAnchors(templateAnchors, documentTokens);
  if (matches.length < minMatches) {
    return {
      ok: false,
      failureCode: "anchor_matches_insufficient",
      matrix: null,
      matchedAnchors: matches,
      metrics: {
        inlierRatio: 0,
        reprojectionErrorPx: Number.POSITIVE_INFINITY,
        matchCount: matches.length,
        inlierCount: 0,
      },
    };
  }

  let best = null;
  if (matches.length >= 3) {
    const candidateTriples = combinations3(matches.slice(0, Math.min(12, matches.length)));
    for (const triple of candidateTriples) {
      const matrix = estimateAffineFrom3Pairs(triple);
      if (!matrix) continue;
      const metrics = evaluateMatrix(matrix, matches, inlierThresholdPx);
      if (
        !best ||
        metrics.inliers > best.metrics.inliers ||
        (metrics.inliers === best.metrics.inliers && metrics.meanError < best.metrics.meanError)
      ) {
        best = { matrix, metrics };
      }
    }
  } else if (matches.length === 2) {
    const matrix = estimateScaleTranslateFrom2Pairs(matches);
    if (matrix) {
      const metrics = evaluateMatrix(matrix, matches, inlierThresholdPx);
      best = { matrix, metrics };
    }
  }

  if (!best) {
    return {
      ok: false,
      failureCode: "affine_estimation_failed",
      matrix: null,
      matchedAnchors: matches,
      metrics: {
        inlierRatio: 0,
        reprojectionErrorPx: Number.POSITIVE_INFINITY,
        matchCount: matches.length,
        inlierCount: 0,
      },
    };
  }

  return {
    ok: true,
    failureCode: null,
    matrix: best.matrix,
    matchedAnchors: matches,
    metrics: {
      inlierRatio: Number(best.metrics.inlierRatio.toFixed(4)),
      reprojectionErrorPx: Number(best.metrics.meanError.toFixed(3)),
      matchCount: matches.length,
      inlierCount: best.metrics.inliers,
    },
  };
}

function transformBox(box, matrix) {
  if (!hasValidBox(box)) return null;
  const p1 = applyToPoint(matrix, { x: box.x, y: box.y });
  const p2 = applyToPoint(matrix, { x: box.x + box.w, y: box.y });
  const p3 = applyToPoint(matrix, { x: box.x + box.w, y: box.y + box.h });
  const p4 = applyToPoint(matrix, { x: box.x, y: box.y + box.h });
  const xs = [p1.x, p2.x, p3.x, p4.x];
  const ys = [p1.y, p2.y, p3.y, p4.y];
  const x = Math.max(0, Math.min(...xs));
  const y = Math.max(0, Math.min(...ys));
  const w = Math.max(1, Math.max(...xs) - x);
  const h = Math.max(1, Math.max(...ys) - y);
  return { x, y, w, h };
}

export function applyTransformToLayout(templateLayout, matrix) {
  if (!templateLayout || !matrix) return templateLayout;
  const next = structuredClone(templateLayout);

  next.fields = (next.fields || []).map((field) => ({
    ...field,
    labelBox: transformBox(field.labelBox, matrix),
    valueBox: transformBox(field.valueBox, matrix),
  }));

  next.table = {
    ...next.table,
    columns: (next.table?.columns || []).map((col) => ({
      ...col,
      box: transformBox(col.box, matrix),
    })),
    headerBox: transformBox(next.table?.headerBox, matrix),
    dataRegionBox: transformBox(next.table?.dataRegionBox, matrix),
  };

  next.summary = (next.summary || []).map((item) => ({
    ...item,
    valueBox: transformBox(item.valueBox, matrix),
  }));

  next.tokens = (next.tokens || []).map((token) => ({
    ...token,
    bbox: transformBox(token.bbox, matrix) || token.bbox,
  }));

  next.meta = {
    ...next.meta,
    transform: {
      kind: "affine_2d",
      matrix,
    },
  };

  return next;
}

export function assessTransformQuality(transformResult, options = {}) {
  const minInlierRatio = typeof options.minInlierRatio === "number" ? options.minInlierRatio : 0.6;
  const maxReprojectionErrorPx =
    typeof options.maxReprojectionErrorPx === "number" ? options.maxReprojectionErrorPx : 12;
  const minMatches = typeof options.minMatches === "number" ? options.minMatches : 2;

  const metrics = transformResult?.metrics || {};
  const failures = [];
  const matchCount = Number(metrics.matchCount || 0);
  const inlierRatio = Number(metrics.inlierRatio || 0);
  const reprojectionErrorPx = Number(metrics.reprojectionErrorPx || Number.POSITIVE_INFINITY);

  if (!transformResult?.ok) failures.push(transformResult?.failureCode || "transform_not_ok");
  if (matchCount < minMatches) failures.push(`transform_match_count_too_low:${matchCount}<${minMatches}`);
  if (inlierRatio < minInlierRatio) failures.push(`transform_inlier_ratio_too_low:${inlierRatio}<${minInlierRatio}`);
  if (!(reprojectionErrorPx <= maxReprojectionErrorPx)) {
    failures.push(`transform_reprojection_error_too_high:${reprojectionErrorPx}>${maxReprojectionErrorPx}`);
  }

  return {
    isQualified: failures.length === 0,
    inlierRatio,
    reprojectionErrorPx,
    matchCount,
    inlierCount: Number(metrics.inlierCount || 0),
    failures,
    thresholds: { minInlierRatio, maxReprojectionErrorPx, minMatches },
  };
}
