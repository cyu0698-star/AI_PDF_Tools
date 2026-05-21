const TOKEN_ROLES = new Set([
  "fixed_text",
  "fillable_value",
  "table_header",
  "table_cell",
  "unknown",
]);

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
}

function normalizeBox(value) {
  const box = asObject(value);
  const x = Math.max(0, toFiniteNumber(box.x, 0));
  const y = Math.max(0, toFiniteNumber(box.y, 0));
  const w = Math.max(0, toFiniteNumber(box.w, 0));
  const h = Math.max(0, toFiniteNumber(box.h, 0));
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function normalizeFieldType(value) {
  return value === "number" || value === "date" || value === "text" ? value : "text";
}

function normalizeTemplateField(value, index = 0) {
  const field = asObject(value);
  const key = normalizeString(field.key, "").trim() || `field_${index + 1}`;
  const label = normalizeString(field.label, "").trim() || key;
  return {
    key,
    label,
    type: normalizeFieldType(field.type),
    required: Boolean(field.required),
  };
}

export function normalizeTemplateRecognitionResult(value) {
  const root = asObject(value);
  const companyInfo = asObject(root.companyInfo);
  const fields = Array.isArray(companyInfo.fields)
    ? companyInfo.fields.map((field, index) => normalizeTemplateField(field, index))
    : [];
  const tableHeaders = normalizeStringArray(root.tableHeaders);
  const tableFieldTypes = normalizeStringArray(root.tableFieldTypes).map(normalizeFieldType);
  while (tableFieldTypes.length < tableHeaders.length) {
    tableFieldTypes.push("text");
  }
  return {
    companyInfo: { fields },
    tableHeaders,
    tableFieldTypes: tableFieldTypes.slice(0, tableHeaders.length || tableFieldTypes.length),
    summaryFields: normalizeStringArray(root.summaryFields),
  };
}

function normalizeLayoutField(value, index = 0) {
  const field = asObject(value);
  const key = normalizeString(field.key, "").trim() || `field_${index + 1}`;
  const label = normalizeString(field.label, "").trim() || key;
  return {
    key,
    label,
    semanticType: normalizeFieldType(field.semanticType),
    required: Boolean(field.required),
    labelBox: normalizeBox(field.labelBox),
    valueBox: normalizeBox(field.valueBox),
    font: {
      family: field?.font?.family ?? null,
      size: Number.isFinite(Number(field?.font?.size)) ? Number(field.font.size) : null,
      weight: Number.isFinite(Number(field?.font?.weight)) ? Number(field.font.weight) : null,
      estimated: field?.font?.estimated !== false,
    },
    confidence: Math.max(0, Math.min(1, toFiniteNumber(field.confidence, 0))),
  };
}

function normalizeLayoutToken(value, index = 0) {
  const token = asObject(value);
  const text = normalizeString(token.text, "").trim();
  const bbox = normalizeBox(token.bbox);
  if (!text || !bbox) return null;
  const role = normalizeString(token.role, "unknown");
  return {
    id: normalizeString(token.id, "").trim() || `tk_${index + 1}`,
    text,
    bbox,
    confidence: Math.max(0, Math.min(1, toFiniteNumber(token.confidence, 0.8))),
    role: TOKEN_ROLES.has(role) ? role : "unknown",
  };
}

export function normalizeTemplateLayout(value) {
  const root = asObject(value);
  const table = asObject(root.table);
  const tableColumnsRaw = Array.isArray(table.columns) ? table.columns : [];
  const tableColumns = tableColumnsRaw.map((col, index) => {
    const item = asObject(col);
    return {
      key: normalizeString(item.key, "").trim() || `col_${index + 1}`,
      label: normalizeString(item.label, "").trim() || `列${index + 1}`,
      semanticType: normalizeFieldType(item.semanticType),
      box: normalizeBox(item.box),
    };
  });

  const summaryRaw = Array.isArray(root.summary) ? root.summary : [];
  const summary = summaryRaw.map((item, index) => {
    const entry = asObject(item);
    const key = normalizeString(entry.key, "").trim() || `summary_${index + 1}`;
    const label = normalizeString(entry.label, "").trim() || key;
    return {
      key,
      label,
      valueBox: normalizeBox(entry.valueBox),
    };
  });

  const fieldsRaw = Array.isArray(root.fields) ? root.fields : [];
  const fields = fieldsRaw.map((field, index) => normalizeLayoutField(field, index));

  const tokensRaw = Array.isArray(root.tokens) ? root.tokens : [];
  const tokens = tokensRaw
    .map((token, index) => normalizeLayoutToken(token, index))
    .filter(Boolean);

  return {
    version: Math.max(1, Math.floor(toFiniteNumber(root.version, 1))),
    templateName: normalizeString(root.templateName, "未命名模板"),
    sourceType: normalizeString(root.sourceType, "unknown"),
    tokens,
    fields,
    table: {
      columns: tableColumns,
      headerBox: normalizeBox(table.headerBox),
      dataRegionBox: normalizeBox(table.dataRegionBox),
      repeatDirection: "down",
      rowHeight: Math.max(8, toFiniteNumber(table.rowHeight, 40)),
    },
    summary,
    ocrTokenCount: Math.max(0, Math.floor(toFiniteNumber(root.ocrTokenCount, tokens.length))),
    warnings: normalizeStringArray(root.warnings),
    confidence: Math.max(0, Math.min(1, toFiniteNumber(root.confidence, 0.5))),
    createdAt: normalizeString(root.createdAt, new Date().toISOString()),
    meta: {
      pipeline: normalizeString(root?.meta?.pipeline, "unknown"),
      parserVersion: normalizeString(root?.meta?.parserVersion, "unknown"),
      pdfNature: root?.meta?.pdfNature || undefined,
      ocrProvider: normalizeString(root?.meta?.ocrProvider, "unknown"),
      tokenSource: normalizeString(root?.meta?.tokenSource, "unknown"),
    },
  };
}

export function normalizeTemplateModel(value) {
  const root = asObject(value);
  const staticTokensRaw = Array.isArray(root.staticTokens) ? root.staticTokens : [];
  const variableTokensRaw = Array.isArray(root.variableTokens) ? root.variableTokens : [];
  const table = root.table && typeof root.table === "object" ? root.table : null;

  const staticTokens = staticTokensRaw
    .map((token, index) => {
      const t = asObject(token);
      const text = normalizeString(t.text, "").trim();
      const bbox = normalizeBox(t.bbox);
      if (!text || !bbox) return null;
      const kind = t.kind === "table_header" ? "table_header" : "fixed_text";
      return {
        id: normalizeString(t.id, "").trim() || `st_${index + 1}`,
        text,
        bbox,
        kind,
      };
    })
    .filter(Boolean);

  const variableTokens = variableTokensRaw
    .map((token, index) => {
      const t = asObject(token);
      const text = normalizeString(t.text, "").trim();
      const bbox = normalizeBox(t.bbox);
      if (!text || !bbox) return null;
      return {
        id: normalizeString(t.id, "").trim() || `vt_${index + 1}`,
        text,
        bbox,
      };
    })
    .filter(Boolean);

  const normalizedTable =
    table && typeof table === "object"
      ? {
          headerTokenIds: normalizeStringArray(table.headerTokenIds),
          columns: Array.isArray(table.columns)
            ? table.columns.map((col, index) => {
                const c = asObject(col);
                return {
                  key: normalizeString(c.key, "").trim() || `col_${index + 1}`,
                  label: normalizeString(c.label, "").trim() || `列${index + 1}`,
                  x: toFiniteNumber(c.x, 0),
                  tokenId: normalizeString(c.tokenId, ""),
                  box: normalizeBox(c.box) || { x: 0, y: 0, w: 1, h: 1 },
                };
              })
            : [],
          sampleRows: Array.isArray(table.sampleRows)
            ? table.sampleRows.map((row) =>
                Array.isArray(row) ? row.map((cell) => normalizeString(cell, "")) : []
              )
            : [],
          headerY: toFiniteNumber(table.headerY, 0),
        }
      : null;

  return {
    staticTokens,
    variableTokens,
    table: normalizedTable,
    stats: {
      totalTokens: Math.max(0, Math.floor(toFiniteNumber(root?.stats?.totalTokens, staticTokens.length + variableTokens.length))),
      staticCount: Math.max(0, Math.floor(toFiniteNumber(root?.stats?.staticCount, staticTokens.length))),
      variableCount: Math.max(0, Math.floor(toFiniteNumber(root?.stats?.variableCount, variableTokens.length))),
      tableColumns: Math.max(0, Math.floor(toFiniteNumber(root?.stats?.tableColumns, normalizedTable?.columns?.length || 0))),
    },
    warnings: normalizeStringArray(root.warnings),
  };
}

export function normalizeTemplateStructureInput(value) {
  return normalizeTemplateRecognitionResult(value);
}

/**
 * @param {unknown} value
 * @returns {Array<{text:string,bbox?:{x:number,y:number,w:number,h:number}}>}
 */
export function normalizeClientOcrTokens(value) {
  if (!Array.isArray(value)) return [];
  const output = [];
  for (const token of value) {
    const t = asObject(token);
    const text = normalizeString(t.text, "").trim();
    if (!text) continue;
    const bbox = normalizeBox(t.bbox);
    output.push(bbox ? { text, bbox } : { text });
  }
  return output;
}

function normalizeStringRecord(value) {
  const obj = asObject(value);
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (!key) continue;
    out[key] = typeof val === "string" ? val : val == null ? "" : String(val);
  }
  return out;
}

export function normalizeExtractedDataResult(value) {
  const root = asObject(value);
  const tableRowsRaw = Array.isArray(root.tableRows) ? root.tableRows : [];
  const lowConfidenceRaw = Array.isArray(root.lowConfidenceFields) ? root.lowConfidenceFields : [];

  return {
    companyInfo: normalizeStringRecord(root.companyInfo),
    tableRows: tableRowsRaw.map((row) => normalizeStringRecord(row)),
    summary: normalizeStringRecord(root.summary),
    lowConfidenceFields: lowConfidenceRaw
      .map((item) => {
        const entry = asObject(item);
        const key = normalizeString(entry.key, "").trim();
        if (!key) return null;
        return {
          key,
          confidence: Math.max(0, Math.min(1, toFiniteNumber(entry.confidence, 0))),
        };
      })
      .filter(Boolean),
  };
}
