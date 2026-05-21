function normalizeText(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function scoreKey(target, candidate) {
  const a = normalizeText(target);
  const b = normalizeText(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.82;
  let overlap = 0;
  const setB = new Set(b.split(""));
  for (const c of a) {
    if (setB.has(c)) overlap += 1;
  }
  return overlap / Math.max(a.length, b.length);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toStringValue(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function pickValueByTargets(source, targets) {
  const entries = Object.entries(asObject(source));
  if (entries.length === 0) return "";

  let bestValue = "";
  let bestScore = 0;

  for (const [key, value] of entries) {
    for (const target of targets) {
      const score = scoreKey(target, key);
      if (score > bestScore) {
        bestScore = score;
        bestValue = toStringValue(value);
      }
    }
  }
  return bestScore >= 0.55 ? bestValue : "";
}

const SUMMARY_ALIASES = {
  总金额: ["total", "totalamount", "amount", "合计金额", "金额合计"],
  税额: ["tax", "taxamount", "vat", "税金"],
  不含税金额: ["subtotal", "pretax", "amountbeforetax"],
  含税金额: ["grandtotal", "aftertax", "taxincludedamount"],
};

export function mapCompanyInfo(rawCompanyInfo, fields) {
  const safeFields = Array.isArray(fields) ? fields : [];
  const out = {};
  for (const field of safeFields) {
    const key = field?.key || "";
    const label = field?.label || key;
    if (!key) continue;
    const direct = asObject(rawCompanyInfo)[key];
    if (direct != null && String(direct).trim()) {
      out[key] = toStringValue(direct);
      continue;
    }
    out[key] = pickValueByTargets(rawCompanyInfo, [key, label]);
  }
  return out;
}

export function mapSummary(rawSummary, summaryFields) {
  const safeSummaryFields = Array.isArray(summaryFields) ? summaryFields : [];
  const out = {};
  for (const fieldName of safeSummaryFields) {
    if (!fieldName) continue;
    const direct = asObject(rawSummary)[fieldName];
    if (direct != null && String(direct).trim()) {
      out[fieldName] = toStringValue(direct);
      continue;
    }
    const aliases = SUMMARY_ALIASES[fieldName] || [];
    out[fieldName] = pickValueByTargets(rawSummary, [fieldName, ...aliases]);
  }
  return out;
}

export function mapTableRows(rawRows, headers) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  if (safeHeaders.length === 0) return [];
  const rows = Array.isArray(rawRows) ? rawRows : [];

  return rows.map((row) => {
    const mapped = {};
    for (const header of safeHeaders) mapped[header] = "";

    if (Array.isArray(row)) {
      for (let i = 0; i < safeHeaders.length; i += 1) {
        mapped[safeHeaders[i]] = toStringValue(row[i] ?? "");
      }
      return mapped;
    }

    const rowObj = asObject(row);
    const entries = Object.entries(rowObj);
    if (entries.length === 0) return mapped;

    // Pass 1: direct key match
    for (const header of safeHeaders) {
      if (rowObj[header] != null) {
        mapped[header] = toStringValue(rowObj[header]);
      }
    }

    // Pass 2: fuzzy key match for still-empty columns
    for (const header of safeHeaders) {
      if (mapped[header]) continue;
      let bestVal = "";
      let bestScore = 0;
      for (const [k, v] of entries) {
        const score = scoreKey(header, k);
        if (score > bestScore) {
          bestScore = score;
          bestVal = toStringValue(v);
        }
      }
      if (bestScore >= 0.55) mapped[header] = bestVal;
    }

    // Pass 3: if still mostly empty, fallback by property order
    const filledCount = safeHeaders.filter((h) => mapped[h]).length;
    if (filledCount <= 1 && entries.length > 0) {
      for (let i = 0; i < safeHeaders.length && i < entries.length; i += 1) {
        mapped[safeHeaders[i]] = mapped[safeHeaders[i]] || toStringValue(entries[i][1]);
      }
    }

    return mapped;
  });
}
