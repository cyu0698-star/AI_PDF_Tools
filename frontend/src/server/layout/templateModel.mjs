function isValidToken(token) {
  return Boolean(
    token &&
      typeof token.id === "string" &&
      typeof token.text === "string" &&
      token.text.trim() &&
      token.bbox &&
      typeof token.bbox.x === "number" &&
      typeof token.bbox.y === "number" &&
      typeof token.bbox.w === "number" &&
      typeof token.bbox.h === "number" &&
      token.bbox.w > 0 &&
      token.bbox.h > 0
  );
}

const TABLE_HEADER_REGEX =
  /(序号|订单号|产品名称|品名|规格|型号|单位|数量|单价|金额|总额|税率|税额|备注|日期|摘要|借方|贷方|余额)/;
const LABEL_REGEX =
  /(公司|名称|地址|电话|传真|手机|日期|单号|编号|联系人|税号|开户|银行|账号|备注|合计|金额|客户|供方|购方|收货|发货)/;
const VARIABLE_REGEX =
  /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^[A-Za-z0-9\-_/]{6,}$|^[-+]?[\d,.]+(%|元|kg|KG|￥)?$)/;

function tokenCenterX(token) {
  return token.bbox.x + token.bbox.w / 2;
}

function tokenCenterY(token) {
  return token.bbox.y + token.bbox.h / 2;
}

function looksLikeLabel(token) {
  const t = token.text.trim();
  return t.endsWith(":") || t.endsWith("：") || (LABEL_REGEX.test(t) && t.length <= 24);
}

function looksLikeVariable(token) {
  const t = token.text.trim();
  if (!t) return true;
  // Label + concrete value should be treated as variable content.
  if (/[：:]/.test(t) && t.length > 10) return true;
  if (t.length >= 28) return true;
  return VARIABLE_REGEX.test(t);
}

function clusterRows(tokens, tolerance) {
  const rows = [];
  for (const token of tokens) {
    const cy = tokenCenterY(token);
    const row = rows.find((r) => Math.abs(r.y - cy) <= tolerance);
    if (row) {
      row.tokens.push(token);
      row.y = (row.y + cy) / 2;
    } else {
      rows.push({ y: cy, tokens: [token] });
    }
  }
  return rows.sort((a, b) => a.y - b.y);
}

function detectTable(rows) {
  let best = null;
  for (const row of rows) {
    const hits = row.tokens.filter((t) => TABLE_HEADER_REGEX.test(t.text)).length;
    if (hits >= 2 && (!best || hits > best.hits)) {
      best = { row, hits };
    }
  }
  if (!best) return null;

  const headerTokens = [...best.row.tokens].sort((a, b) => tokenCenterX(a) - tokenCenterX(b));
  const columns = headerTokens.map((token, index) => ({
    key: `col_${index + 1}`,
    label: token.text.trim(),
    x: tokenCenterX(token),
    tokenId: token.id,
    box: token.bbox,
  }));

  const dataRows = [];
  for (const row of rows) {
    if (row.y <= best.row.y + 4) continue;
    const cells = new Array(columns.length).fill("");
    for (const token of row.tokens) {
      const cx = tokenCenterX(token);
      let bestIdx = 0;
      let minDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < columns.length; i += 1) {
        const dist = Math.abs(columns[i].x - cx);
        if (dist < minDist) {
          minDist = dist;
          bestIdx = i;
        }
      }
      cells[bestIdx] = cells[bestIdx]
        ? `${cells[bestIdx]} ${token.text.trim()}`
        : token.text.trim();
    }
    if (cells.some((c) => c)) dataRows.push(cells);
    if (dataRows.length >= 8) break;
  }

  return {
    headerTokenIds: headerTokens.map((t) => t.id),
    columns,
    sampleRows: dataRows.length > 0 ? dataRows : new Array(3).fill(null).map(() => new Array(columns.length).fill("")),
    headerY: best.row.y,
  };
}

/**
 * Build a deterministic, explainable template model from OCR tokens.
 * @param {Array<{id:string,text:string,bbox:{x:number,y:number,w:number,h:number},role?:string}>} rawTokens
 */
export function buildTemplateModel(rawTokens) {
  const tokens = Array.isArray(rawTokens) ? rawTokens.filter(isValidToken) : [];
  if (tokens.length === 0) {
    return {
      staticTokens: [],
      variableTokens: [],
      table: null,
      stats: { totalTokens: 0, staticCount: 0, variableCount: 0, tableColumns: 0 },
      warnings: ["template_model_no_tokens"],
    };
  }

  const avgH = tokens.reduce((acc, t) => acc + t.bbox.h, 0) / tokens.length;
  const rowTolerance = Math.max(8, avgH * 0.8);
  const rows = clusterRows(tokens, rowTolerance);
  const table = detectTable(rows);
  const headerIdSet = new Set(table?.headerTokenIds || []);

  const staticTokens = [];
  const variableTokens = [];
  for (const token of tokens) {
    const text = token.text.trim();
    const forcedHeader = headerIdSet.has(token.id);
    const roleHeader = token.role === "table_header";
    const roleStatic = token.role === "fixed_text";

    const containsHeaderKeyword = TABLE_HEADER_REGEX.test(text);
    const hasInlineValue = /[：:]/.test(text) && text.length > 10;
    const isStatic =
      forcedHeader ||
      roleHeader ||
      roleStatic ||
      looksLikeLabel(token) ||
      (containsHeaderKeyword && text.length <= 16 && !hasInlineValue);

    if (isStatic) {
      staticTokens.push({
        id: token.id,
        text,
        bbox: token.bbox,
        kind: forcedHeader || roleHeader ? "table_header" : "fixed_text",
      });
      continue;
    }

    if (looksLikeVariable(token)) {
      variableTokens.push({
        id: token.id,
        text,
        bbox: token.bbox,
      });
      continue;
    }

    // Conservative default: keep uncertain short text as static so template preview remains complete.
    staticTokens.push({
      id: token.id,
      text,
      bbox: token.bbox,
      kind: "fixed_text",
    });
  }

  return {
    staticTokens,
    variableTokens,
    table,
    stats: {
      totalTokens: tokens.length,
      staticCount: staticTokens.length,
      variableCount: variableTokens.length,
      tableColumns: table?.columns?.length || 0,
    },
    warnings: [],
  };
}
