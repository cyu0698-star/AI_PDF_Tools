export function shouldUseLayoutExport(template) {
  const fields = Array.isArray(template?.templateLayout?.fields)
    ? template.templateLayout.fields
    : [];
  const usable = fields.some(
    (f) =>
      f &&
      f.valueBox &&
      typeof f.valueBox.x === "number" &&
      typeof f.valueBox.y === "number" &&
      typeof f.valueBox.w === "number" &&
      typeof f.valueBox.h === "number"
  );
  return Boolean(
    template &&
      template.templateLayout &&
      fields.length > 0 &&
      usable
  );
}

export function buildLayoutWritePlan(templateLayout, formData) {
  const fields = Array.isArray(templateLayout?.fields)
    ? templateLayout.fields
    : [];
  const companyInfo = formData?.companyInfo || {};

  return fields.map((field) => {
    const value = companyInfo[field.key] || "";
    return {
      key: field.key,
      label: field.label,
      value,
      x: field.valueBox?.x ?? null,
      y: field.valueBox?.y ?? null,
      w: field.valueBox?.w ?? null,
      h: field.valueBox?.h ?? null,
      confidence: field.confidence ?? 0,
    };
  });
}

export function buildLayoutPreviewGrid(layoutPlan, options = {}) {
  const maxRows = typeof options.maxRows === "number" ? options.maxRows : 60;
  const maxCols = typeof options.maxCols === "number" ? options.maxCols : 28;
  const safePlan = Array.isArray(layoutPlan)
    ? layoutPlan.filter(
        (p) =>
          typeof p?.x === "number" &&
          typeof p?.y === "number" &&
          typeof p?.w === "number" &&
          typeof p?.h === "number"
      )
    : [];

  const matrix = Array.from({ length: maxRows }, () => Array(maxCols).fill(""));
  const colWidths = Array.from({ length: maxCols }, () => ({ wch: 14 }));
  const rowHeights = Array.from({ length: maxRows }, () => ({ hpt: 20 }));

  if (safePlan.length === 0) {
    matrix[0][0] = "暂无可用坐标";
    return { matrix, colWidths, rowHeights };
  }

  const clusterAxis = (values, tolerance) => {
    if (values.length === 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const groups = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i += 1) {
      const v = sorted[i];
      const g = groups[groups.length - 1];
      const center = g.reduce((acc, n) => acc + n, 0) / g.length;
      if (Math.abs(v - center) <= tolerance) {
        g.push(v);
      } else {
        groups.push([v]);
      }
    }
    return groups.map((g) => g.reduce((acc, n) => acc + n, 0) / g.length);
  };

  const pickClusterIndex = (value, clusters) => {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i += 1) {
      const d = Math.abs(value - clusters[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const avgW =
    safePlan.reduce((acc, p) => acc + p.w, 0) / Math.max(1, safePlan.length);
  const avgH =
    safePlan.reduce((acc, p) => acc + p.h, 0) / Math.max(1, safePlan.length);
  const xCenters = safePlan.map((p) => p.x + p.w / 2);
  const yCenters = safePlan.map((p) => p.y + p.h / 2);
  const xClusters = clusterAxis(xCenters, Math.max(18, avgW * 0.55));
  const yClusters = clusterAxis(yCenters, Math.max(12, avgH * 0.7));

  const used = new Set();
  const place = (row, col, text) => {
    const key = `${row}:${col}`;
    if (!used.has(key)) {
      matrix[row][col] = text;
      used.add(key);
      return;
    }
    for (let offset = 1; offset < 4; offset += 1) {
      const c = col + offset;
      if (c >= maxCols) break;
      const k = `${row}:${c}`;
      if (!used.has(k)) {
        matrix[row][c] = text;
        used.add(k);
        return;
      }
    }
  };

  for (const item of safePlan) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const rowBand = pickClusterIndex(cy, yClusters);
    const colBand = pickClusterIndex(cx, xClusters);
    const row = Math.max(0, Math.min(maxRows - 1, rowBand * 2));
    const col = Math.max(1, Math.min(maxCols - 1, colBand * 2 + 1));
    place(row, col - 1, `${item.label}`);
    place(row, col, `${item.value || ""}`);
  }

  return { matrix, colWidths, rowHeights };
}
