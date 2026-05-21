import {
  isPdfMimeType,
  isSupportedTemplateExtractMimeType,
  isSupportedVisionImageMimeType,
  normalizeMimeType,
} from "./fileTypes.mjs";
import {
  alignSemanticFieldsToTokens,
  applyAlignedBoxesToLayout,
} from "./aligner.mjs";
import { parseOcrLayout } from "./pipelines/ocrPipeline.mjs";
import { parseElectronicPdfLayout } from "./pipelines/electronicPdfPipeline.mjs";

export const TEMPLATE_LAYOUT_VERSION = 1;

const LABEL_KEYWORDS = [
  "公司名称",
  "客户名称",
  "客户地址",
  "送货单号",
  "地址",
  "电话",
  "传真",
  "手机",
  "日期",
  "单号",
  "编号",
  "联系人",
  "税号",
  "开户",
  "银行",
  "账号",
  "备注",
  "合计",
  "金额",
  "抬头",
  "客户",
  "供方",
  "购方",
  "收货",
  "发货",
  "规格",
  "品名",
];

const TABLE_HEADER_KEYWORDS = [
  "序号",
  "订单号",
  "产品名称",
  "品名",
  "规格",
  "型号",
  "单位",
  "数量",
  "单价",
  "总额",
  "金额",
  "税率",
  "税额",
  "备注",
  "日期",
  "摘要",
  "借方",
  "贷方",
  "余额",
];

const SPLIT_TERMS = Array.from(
  new Set([...LABEL_KEYWORDS, ...TABLE_HEADER_KEYWORDS])
).sort((a, b) => b.length - a.length);
const SPLIT_REGEX = new RegExp(`(${SPLIT_TERMS.join("|")})`, "g");

function normalizeSemantic(semantic) {
  return {
    companyInfo: {
      fields: Array.isArray(semantic?.companyInfo?.fields)
        ? semantic.companyInfo.fields
        : [],
    },
    tableHeaders: Array.isArray(semantic?.tableHeaders) ? semantic.tableHeaders : [],
    tableFieldTypes: Array.isArray(semantic?.tableFieldTypes)
      ? semantic.tableFieldTypes
      : [],
    summaryFields: Array.isArray(semantic?.summaryFields)
      ? semantic.summaryFields
      : [],
  };
}

function isValidBox(box) {
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

function splitCompositeToken(token) {
  if (!token || typeof token.text !== "string" || !isValidBox(token.bbox)) {
    return [];
  }
  const text = token.text.trim();
  if (!text || text.length < 24) return [token];

  const matches = Array.from(text.matchAll(SPLIT_REGEX));
  if (matches.length < 2 || token.bbox.w < 60) return [token];

  const starts = [0];
  for (const m of matches) {
    const idx = typeof m.index === "number" ? m.index : -1;
    if (idx > 0) starts.push(idx);
  }
  const uniqueStarts = Array.from(new Set(starts)).sort((a, b) => a - b);
  if (uniqueStarts.length < 2) return [token];

  const parts = [];
  for (let i = 0; i < uniqueStarts.length; i += 1) {
    const start = uniqueStarts[i];
    const end = i === uniqueStarts.length - 1 ? text.length : uniqueStarts[i + 1];
    const part = text.slice(start, end).trim();
    if (part) parts.push(part);
  }
  if (parts.length < 2) return [token];

  const totalWeight = parts.reduce((acc, part) => acc + Math.max(1, part.length), 0);
  let cursorX = token.bbox.x;
  const coarseParts = parts.map((part, idx) => {
    const ratio = Math.max(1, part.length) / totalWeight;
    const targetW =
      idx === parts.length - 1
        ? token.bbox.x + token.bbox.w - cursorX
        : Math.max(4, token.bbox.w * ratio);
    const current = {
      text: part,
      bbox: {
        x: cursorX,
        y: token.bbox.y,
        w: targetW,
        h: token.bbox.h,
      },
      confidence: token.confidence,
    };
    cursorX += targetW;
    return current;
  });

  // Secondary split for "标签:值" patterns so label can remain as fixed template text.
  const labelValueRegex = /^([\u4e00-\u9fa5A-Za-z0-9()（）\-]{1,16}[：:])(.+)$/;
  const refined = [];
  for (const part of coarseParts) {
    const m = part.text.match(labelValueRegex);
    if (!m) {
      refined.push(part);
      continue;
    }
    const labelText = m[1].trim();
    const valueText = m[2].trim();
    if (!labelText || !valueText) {
      refined.push(part);
      continue;
    }
    const allLen = Math.max(1, part.text.length);
    const labelRatio = Math.max(0.15, Math.min(0.6, labelText.length / allLen));
    const labelW = Math.max(6, part.bbox.w * labelRatio);
    const valueW = Math.max(4, part.bbox.w - labelW);
    refined.push({
      text: labelText,
      bbox: {
        x: part.bbox.x,
        y: part.bbox.y,
        w: labelW,
        h: part.bbox.h,
      },
      confidence: part.confidence,
    });
    refined.push({
      text: valueText,
      bbox: {
        x: part.bbox.x + labelW,
        y: part.bbox.y,
        w: valueW,
        h: part.bbox.h,
      },
      confidence: part.confidence,
    });
  }

  return refined.length > 0 ? refined : coarseParts;
}

function normalizeTokens(tokens) {
  const safe = Array.isArray(tokens) ? tokens : [];
  const normalized = [];
  for (let i = 0; i < safe.length; i += 1) {
    const token = safe[i];
    if (!token || typeof token.text !== "string") continue;
    const text = token.text.trim();
    if (!text) continue;
    if (!isValidBox(token.bbox)) continue;
    const base = {
      text,
      bbox: {
        x: token.bbox.x,
        y: token.bbox.y,
        w: token.bbox.w,
        h: token.bbox.h,
      },
      confidence:
        typeof token.confidence === "number" && !Number.isNaN(token.confidence)
          ? Number(Math.max(0, Math.min(1, token.confidence)).toFixed(3))
          : 0.8,
    };
    const expanded = splitCompositeToken(base);
    for (let j = 0; j < expanded.length; j += 1) {
      const ex = expanded[j];
      normalized.push({
        id: `tk_${i + 1}_${j + 1}`,
        text: ex.text,
        bbox: ex.bbox,
        confidence: ex.confidence,
        role: "unknown",
      });
    }
  }
  return normalized;
}

function classifyTokens(tokens) {
  const safe = Array.isArray(tokens) ? tokens : [];
  if (safe.length === 0) return [];

  const labelKeywords = /(公司|名称|地址|电话|传真|日期|单号|编号|联系人|税号|开户|银行|账号|备注|合计|金额|抬头|客户|供方|购方|收货|发货|规格|品名)/;
  const tableHeaderKeywords = /(序号|订单号|产品名称|品名|规格|型号|单位|数量|单价|总额|金额|税率|税额|备注|日期|摘要|借方|贷方|余额)/;
  const numericLike = /^[-+]?[\d,.]+(%|元|kg|KG|￥)?$/;

  const byRole = safe.map((token) => {
    let role = "unknown";
    const text = token.text;
    const trimmedText = (text || "").trim();
    const tableHits = TABLE_HEADER_KEYWORDS.reduce(
      (acc, kw) => (text.includes(kw) ? acc + 1 : acc),
      0
    );
    const labelHits = LABEL_KEYWORDS.reduce(
      (acc, kw) => (text.includes(kw) ? acc + 1 : acc),
      0
    );

    const headerLikeText =
      tableHeaderKeywords.test(trimmedText) &&
      // Keep pure short labels as headers, avoid classifying "产品名称: xxx" as header.
      trimmedText.length <= 16 &&
      !/[：:]/.test(trimmedText);

    if (tableHits >= 2 || headerLikeText) {
      role = "table_header";
    } else if (
      text.endsWith(":") ||
      text.endsWith("：") ||
      labelHits >= 1 ||
      labelKeywords.test(text)
    ) {
      role = "fixed_text";
    } else if (numericLike.test(text) || /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(text)) {
      role = "fillable_value";
    } else if (text.length >= 8) {
      role = "fillable_value";
    } else {
      role = "fixed_text";
    }
    return { ...token, role };
  });

  const headerTokens = byRole.filter((t) => t.role === "table_header");
  if (headerTokens.length > 0) {
    const headerTop = Math.min(...headerTokens.map((t) => t.bbox.y));
    const headerBottom = Math.max(
      ...headerTokens.map((t) => t.bbox.y + t.bbox.h)
    );
    for (const token of byRole) {
      if (token.role === "table_header") continue;
      if (token.bbox.y > headerBottom + 2 && token.bbox.y < headerBottom + 320) {
        if (token.bbox.x >= Math.min(...headerTokens.map((h) => h.bbox.x)) - 20) {
          token.role = "table_cell";
        }
      }
      if (token.bbox.y >= headerTop && token.bbox.y <= headerBottom + 8) {
        if (token.role === "unknown") token.role = "table_header";
      }
    }
  }

  // Label-value pairing pass: if a fixed_text has right-side neighbor on same line, mark neighbor fillable.
  for (const labelToken of byRole) {
    if (labelToken.role !== "fixed_text") continue;
    const rightX = labelToken.bbox.x + labelToken.bbox.w;
    const centerY = labelToken.bbox.y + labelToken.bbox.h / 2;
    let best = null;
    let bestScore = -Infinity;
    for (const token of byRole) {
      if (token.id === labelToken.id) continue;
      if (token.role === "table_header") continue;
      const dx = token.bbox.x - rightX;
      if (dx < 0 || dx > Math.max(220, labelToken.bbox.w * 10)) continue;
      const tokenCenterY = token.bbox.y + token.bbox.h / 2;
      const dy = Math.abs(tokenCenterY - centerY);
      if (dy > Math.max(24, labelToken.bbox.h * 1.6)) continue;
      const score = 1 - dx / 240 - dy / 60;
      if (score > bestScore) {
        bestScore = score;
        best = token;
      }
    }
    if (best && best.role !== "table_cell") {
      best.role = "fillable_value";
    }
  }

  return byRole;
}

function normalizeFieldKey(label, index) {
  const normalized = (label || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 24);
  return normalized ? `field_${normalized}` : `field_${index + 1}`;
}

function inferSemanticFromTokens(tokens) {
  const safeTokens = Array.isArray(tokens) ? tokens : [];
  const seen = new Set();
  const keywordLike = /(公司|名称|地址|电话|传真|日期|单号|编号|联系人|税号|开户|银行|账号|备注|合计|金额|抬头|客户|供方|购方|收货|发货|规格|品名)/;

  const preferred = safeTokens.filter((t) => t.role === "fixed_text");
  const tokenPool = preferred.length > 0 ? preferred : safeTokens;

  const candidates = tokenPool
    .filter((token) => {
      if (!token || typeof token.text !== "string") return false;
      const text = token.text.trim();
      if (!text || text.length > 16) return false;
      if (seen.has(text)) return false;
      const box = token.bbox;
      if (!box || typeof box.w !== "number" || typeof box.h !== "number" || box.w <= 0 || box.h <= 0) {
        return false;
      }
      return (
        keywordLike.test(text) ||
        text.endsWith(":") ||
        text.endsWith("：") ||
        text.length <= 8
      );
    })
    .slice(0, 20);

  if (candidates.length === 0) {
    for (const token of tokenPool) {
      if (!token || typeof token.text !== "string") continue;
      const text = token.text.trim();
      if (!text || text.length > 10 || seen.has(text)) continue;
      const box = token.bbox;
      if (!box || typeof box.w !== "number" || typeof box.h !== "number" || box.w <= 0 || box.h <= 0) continue;
      candidates.push(token);
      if (candidates.length >= 8) break;
    }
  }

  const fields = candidates.map((token, index) => {
    const label = token.text.trim().replace(/[:：]\s*$/, "");
    seen.add(label);
    return {
      key: normalizeFieldKey(label, index),
      label,
      type: "text",
      required: false,
    };
  });

  return {
    companyInfo: { fields },
    tableHeaders: [],
    tableFieldTypes: [],
    summaryFields: [],
  };
}

export function inferPdfNature(fileBase64) {
  if (!fileBase64) return "unknown";
  try {
    const snippet = Buffer.from(fileBase64, "base64")
      .toString("latin1")
      .slice(0, 3000);
    if (snippet.includes("/Font") || snippet.includes("BT")) {
      return "electronic";
    }
    return "scanned";
  } catch {
    return "unknown";
  }
}

function inferSourceType(mimeType, pdfNature) {
  if (isPdfMimeType(mimeType)) {
    if (pdfNature === "electronic") return "electronic_pdf";
    if (pdfNature === "scanned") return "scanned_pdf";
    return "unknown";
  }
  if (isSupportedVisionImageMimeType(mimeType)) return "image";
  return "unknown";
}

function estimateConfidence(layout) {
  const fields = layout?.fields || [];
  if (fields.length === 0) return 0.5;

  const total = fields.reduce((acc, f) => acc + (f.confidence || 0), 0);
  return Number((total / fields.length).toFixed(3));
}

function buildLayoutSkeleton({ templateName, sourceType, semantic, ocrTokens }) {
  const fields = semantic.companyInfo.fields.map((field) => ({
    key: field.key,
    label: field.label,
    semanticType: field.type || "text",
    required: Boolean(field.required),
    labelBox: null,
    valueBox: null,
    font: {
      family: null,
      size: null,
      weight: null,
      estimated: true,
    },
    confidence: 0,
  }));

  const baseLayout = {
    version: TEMPLATE_LAYOUT_VERSION,
    templateName: templateName || "未命名模板",
    sourceType,
    tokens: Array.isArray(ocrTokens) ? ocrTokens : [],
    fields,
    table: {
      columns: semantic.tableHeaders.map((h, i) => ({
        key: `col_${i + 1}`,
        label: h,
        semanticType: semantic.tableFieldTypes[i] || "text",
        box: null,
      })),
      headerBox: null,
      dataRegionBox: null,
      repeatDirection: "down",
      rowHeight: 40,
    },
    summary: semantic.summaryFields.map((name) => ({
      key: name,
      label: name,
      valueBox: null,
    })),
    ocrTokenCount: Array.isArray(ocrTokens) ? ocrTokens.length : 0,
    warnings: [],
    confidence: 0.5,
    createdAt: new Date().toISOString(),
    meta: {
      pipeline: "unknown",
      parserVersion: "phase3-skeleton",
      pdfNature: sourceType.includes("pdf") ? "unknown" : undefined,
      ocrProvider: "unknown",
      tokenSource: "unknown",
    },
  };

  return baseLayout;
}

/**
 * @param {{
 *   fileBase64: string,
 *   mimeType: string,
 *   templateName?: string,
 *   semanticAnalyzer?: ((input: {fileBase64: string, mimeType: string, sourceType: string}) => Promise<any>) | null,
 *   ocrTokens?: Array<{text: string, bbox?: {x:number,y:number,w:number,h:number}}>,
 *   pipelines?: {
 *     ocr?: (input: {fileBase64: string, mimeType: string, sourceType: string}) => Promise<any>,
 *     electronicPdf?: (input: {fileBase64: string, mimeType: string, sourceType: string}) => Promise<any>,
 *   }
 * }} params
 */
export async function analyzeTemplateLayout({
  fileBase64,
  mimeType,
  templateName = "",
  semanticAnalyzer = null,
  ocrTokens = null,
  pipelines = {
    ocr: parseOcrLayout,
    electronicPdf: parseElectronicPdfLayout,
  },
} = {}) {
  const normalizedMime = normalizeMimeType(mimeType);
  if (!isSupportedTemplateExtractMimeType(normalizedMime)) {
    throw new Error(`不支持的模板文件类型: ${normalizedMime || "unknown"}`);
  }
  if (!fileBase64) {
    throw new Error("fileBase64 不能为空");
  }

  const pdfNature = isPdfMimeType(normalizedMime)
    ? inferPdfNature(fileBase64)
    : "unknown";
  const sourceType = inferSourceType(normalizedMime, pdfNature);
  const pipelineResult =
    sourceType === "electronic_pdf"
      ? await pipelines.electronicPdf({
          fileBase64,
          mimeType: normalizedMime,
          sourceType,
          clientTokens: Array.isArray(ocrTokens) ? ocrTokens : undefined,
        })
      : await pipelines.ocr({
          fileBase64,
          mimeType: normalizedMime,
          sourceType,
          clientTokens: Array.isArray(ocrTokens) ? ocrTokens : undefined,
        });

  const hasExplicitTokens = Array.isArray(ocrTokens) && ocrTokens.length > 0;
  const rawTokens = hasExplicitTokens
    ? ocrTokens
    : Array.isArray(pipelineResult?.tokens)
      ? pipelineResult.tokens
      : [];
  const effectiveTokens = classifyTokens(normalizeTokens(rawTokens));

  const rawSemantic =
    typeof semanticAnalyzer === "function"
      ? await semanticAnalyzer({
          fileBase64,
          mimeType: normalizedMime,
          sourceType,
        })
      : null;
  const semantic = normalizeSemantic(rawSemantic);
  const inferredSemantic = inferSemanticFromTokens(effectiveTokens);
  const effectiveSemantic =
    semantic.companyInfo.fields.length > 0 ? semantic : inferredSemantic;

  let layout = buildLayoutSkeleton({
    templateName,
    sourceType,
    semantic: effectiveSemantic,
    ocrTokens: effectiveTokens,
  });

  if (effectiveTokens.length > 0 && layout.fields.length > 0) {
    const mappings = alignSemanticFieldsToTokens(layout.fields, effectiveTokens);
    layout = applyAlignedBoxesToLayout(layout, mappings);
  } else if (effectiveTokens.length === 0) {
    layout.warnings.push("no_ocr_tokens_provided");
  } else if (layout.fields.length === 0) {
    layout.warnings.push("no_semantic_fields_detected");
  }

  if (Array.isArray(pipelineResult?.warnings)) {
    layout.warnings.push(...pipelineResult.warnings);
  }

  layout.meta = {
    pipeline:
      pipelineResult?.pipeline === "electronic_pdf" ? "electronic_pdf" : "ocr",
    parserVersion: "phase3-skeleton",
    pdfNature: sourceType.includes("pdf") ? pdfNature : undefined,
    ocrProvider: pipelineResult?.provider || "unknown",
    tokenSource: hasExplicitTokens ? "client" : "pipeline",
  };

  layout.confidence = estimateConfidence(layout);
  return layout;
}
