// xlsx-js-style is API-compatible with xlsx but actually writes cell.s
// (borders/fonts/fills/alignment). The community `xlsx` package silently
// drops these — verified by inspecting xl/styles.xml after writeFile.
import * as XLSX from 'xlsx-js-style';
import { CustomTemplate, FilledFormData, ProcessResult, TemplateLayout } from "@/features/documents/types";

// Group template's static OCR tokens (role==="fixed_text") into reading-order
// lines, splitting around the table region. Returns plain text rows ready to
// be dropped into the sheet as merged-width header/footer bands.
function buildTemplateTextBands(layout: TemplateLayout | undefined): {
  headerLines: string[];
  footerLines: string[];
} {
  if (!layout || !Array.isArray(layout.tokens)) {
    return { headerLines: [], footerLines: [] };
  }

  // Prefer explicit header/data boxes if the parser provided them. Otherwise
  // fall back to using `table_header` role tokens as the table boundary —
  // this is how the analyze pipeline now labels them, and parser may not
  // always set headerBox/dataRegionBox.
  let tableTop: number | null =
    typeof layout.table?.headerBox?.y === "number" ? layout.table.headerBox.y : null;
  let tableBottom: number | null =
    layout.table?.dataRegionBox &&
    typeof layout.table.dataRegionBox.y === "number" &&
    typeof layout.table.dataRegionBox.h === "number"
      ? layout.table.dataRegionBox.y + layout.table.dataRegionBox.h
      : null;

  const headerRoleTokens = layout.tokens.filter(
    (t) => t && t.role === "table_header" && t.bbox && typeof t.bbox.y === "number"
  );
  if (tableTop === null && headerRoleTokens.length > 0) {
    tableTop = Math.min(...headerRoleTokens.map((t) => t.bbox.y));
  }
  // Without an explicit dataRegionBox, approximate table-bottom as a few
  // line-heights below the table header — anything below that we treat as
  // footer text (注：..., 签名盖章 etc.).
  if (tableBottom === null && tableTop !== null) {
    const avgH = headerRoleTokens.length > 0
      ? headerRoleTokens.reduce((a, t) => a + (t.bbox.h || 20), 0) / headerRoleTokens.length
      : 20;
    // Heuristic: data area is usually 10-30 rows tall. Use a generous estimate
    // that captures most footers but doesn't sweep up legit table cells.
    tableBottom = tableTop + avgH * 20;
  }

  const fixed = layout.tokens.filter((t) => t && t.role === "fixed_text" && t.bbox);
  const header: typeof fixed = [];
  const footer: typeof fixed = [];
  for (const t of fixed) {
    if (tableTop !== null && t.bbox.y < tableTop - 4) header.push(t);
    else if (tableBottom !== null && t.bbox.y > tableBottom + 4) footer.push(t);
    else if (tableTop === null) {
      // No table at all → treat everything as header (still better than nothing)
      header.push(t);
    }
  }

  const groupByY = (arr: typeof fixed): string[] => {
    if (arr.length === 0) return [];
    const sorted = [...arr].sort((a, b) => a.bbox.y - b.bbox.y);
    const lines: (typeof fixed)[] = [];
    const tol = 12;
    for (const t of sorted) {
      const last = lines[lines.length - 1];
      const lastY = last ? last[0].bbox.y : -Infinity;
      if (last && Math.abs(t.bbox.y - lastY) <= tol) last.push(t);
      else lines.push([t]);
    }
    return lines.map((line) => {
      line.sort((a, b) => a.bbox.x - b.bbox.x);
      // Join with 2 spaces between adjacent tokens; preserves readability
      // without trying to recreate exact pixel positions.
      return line.map((t) => (t.text || "").trim()).filter(Boolean).join("  ");
    });
  };

  return { headerLines: groupByY(header), footerLines: groupByY(footer) };
}

export type ExportFormat = 'excel' | 'csv' | 'json';

// Export filled form data to Excel.
// Layout: single sheet, top-to-bottom — title block (company info) → summary
// fields (2-col k/v) → main detail table (auto 序号 + tableHeaders + rows).
// All non-empty data cells are bordered for a clean print-ready look.
export function exportFilledFormToExcel(
  template: CustomTemplate,
  formData: FilledFormData,
  filename?: string
): void {
  const wb = XLSX.utils.book_new();

  const tableHeaders = template.structure.tableHeaders || [];
  const tableRows = formData.tableRows || [];
  const summaryFields = template.structure.summaryFields || [];
  const companyFields = template.structure.companyInfo.fields || [];

  // Number of columns the main detail table will occupy (序号 + headers)
  const detailColCount = Math.max(2, tableHeaders.length + 1);
  // Total columns of the sheet; summary rows lay out as label/value pairs across
  // the same width so the title block looks balanced.
  const totalCols = Math.max(detailColCount, 4);

  // ---- Build AoA (Array of Arrays) row by row ----
  const aoa: (string | number)[][] = [];
  // Track merges + cells that need a border so we apply them after aoa_to_sheet.
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const borderedCells: { r: number; c: number }[] = [];
  const titleCells: { r: number; c: number }[] = [];
  const headerCells: { r: number; c: number }[] = [];

  const pushBlankRow = () => {
    aoa.push(Array(totalCols).fill(""));
  };

  // 1) Header bands — render template's static "fixed_text" tokens above the
  // table as merged-width text lines, preserving reading order. This brings
  // the original company letterhead (公司名/地址/电话/传真/手机/"送 货 单" caption)
  // into the export instead of just showing a synthetic template name.
  const { headerLines, footerLines } = buildTemplateTextBands(template.templateLayout);
  if (headerLines.length > 0) {
    headerLines.forEach((line, i) => {
      const rowIdx = aoa.length;
      const row = Array(totalCols).fill("") as (string | number)[];
      row[0] = line;
      aoa.push(row);
      merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      // First line tends to be the company name — treat as title.
      if (i === 0) titleCells.push({ r: rowIdx, c: 0 });
    });
  } else {
    // Fallback: synthetic title row if template has no recognizable header.
    aoa.push([template.name || "单据", ...Array(totalCols - 1).fill("")]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
    titleCells.push({ r: 0, c: 0 });
  }

  // 2) Company info block — each field on its own row, label | value (merged value)
  if (companyFields.length > 0) {
    pushBlankRow();
    for (const field of companyFields) {
      const rowIdx = aoa.length;
      const row: (string | number)[] = Array(totalCols).fill("");
      row[0] = field.label;
      row[1] = formData.companyInfo[field.key] || "";
      aoa.push(row);
      // Merge value cell across remaining columns for breathing room.
      if (totalCols > 2) {
        merges.push({ s: { r: rowIdx, c: 1 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
      borderedCells.push({ r: rowIdx, c: 0 }, { r: rowIdx, c: 1 });
    }
  }

  // 3) Summary block — label/value pairs, 2 pairs per row when totalCols >= 4
  if (summaryFields.length > 0) {
    pushBlankRow();
    const pairsPerRow = totalCols >= 4 ? 2 : 1;
    for (let i = 0; i < summaryFields.length; i += pairsPerRow) {
      const rowIdx = aoa.length;
      const row: (string | number)[] = Array(totalCols).fill("");
      for (let p = 0; p < pairsPerRow; p += 1) {
        const field = summaryFields[i + p];
        if (!field) break;
        const colSpan = Math.floor(totalCols / pairsPerRow);
        const baseCol = p * colSpan;
        row[baseCol] = field;
        row[baseCol + 1] = formData.summary[field] || "";
        borderedCells.push(
          { r: rowIdx, c: baseCol },
          { r: rowIdx, c: baseCol + 1 }
        );
        // Merge value cell up to next pair / sheet edge.
        const valueEndCol = p === pairsPerRow - 1
          ? totalCols - 1
          : (p + 1) * colSpan - 1;
        if (valueEndCol > baseCol + 1) {
          merges.push({
            s: { r: rowIdx, c: baseCol + 1 },
            e: { r: rowIdx, c: valueEndCol },
          });
        }
      }
      aoa.push(row);
    }
  }

  // 4) Detail table — auto 序号 column only if template doesn't already define one.
  if (tableHeaders.length > 0) {
    pushBlankRow();
    // Avoid duplicate 序号 column if template already includes it.
    const headerHasSeq = tableHeaders.some((h) => h === "序号" || h === "序 号");
    const finalHeaders = headerHasSeq ? tableHeaders : ["序号", ...tableHeaders];
    const finalColCount = finalHeaders.length;

    // Header row
    const headerRowIdx = aoa.length;
    const headerRow: (string | number)[] = [...finalHeaders];
    while (headerRow.length < totalCols) headerRow.push("");
    aoa.push(headerRow);
    for (let c = 0; c < finalColCount; c += 1) {
      headerCells.push({ r: headerRowIdx, c });
      borderedCells.push({ r: headerRowIdx, c });
    }

    // Data rows — always emit at least 1 row so the table is visible.
    const dataRows = tableRows.length > 0 ? tableRows : [{}];
    dataRows.forEach((row, idx) => {
      const rowIdx = aoa.length;
      const out: (string | number)[] = [];
      for (const header of finalHeaders) {
        if (header === "序号" || header === "序 号") {
          // Prefer model-provided 序号 if non-empty, else auto-number.
          const provided = row[header];
          out.push(provided !== undefined && provided !== "" ? provided : idx + 1);
        } else {
          out.push(row[header] || "");
        }
      }
      while (out.length < totalCols) out.push("");
      aoa.push(out);
      for (let c = 0; c < finalColCount; c += 1) {
        borderedCells.push({ r: rowIdx, c });
      }
    });
  }

  // 5) Footer bands — fixed_text tokens below the table (注：..., 签名盖章 etc.)
  if (footerLines.length > 0) {
    pushBlankRow();
    footerLines.forEach((line) => {
      const rowIdx = aoa.length;
      const row = Array(totalCols).fill("") as (string | number)[];
      row[0] = line;
      aoa.push(row);
      merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
    });
  }

  // ---- Build worksheet (after ALL rows are pushed) ----
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths: { wch: number }[] = [];
  for (let c = 0; c < totalCols; c += 1) {
    if (tableHeaders.length > 0 && c === 0) colWidths.push({ wch: 6 });
    else colWidths.push({ wch: 16 });
  }
  ws["!cols"] = colWidths;
  ws["!merges"] = merges;

  // ---- Apply styles (borders / center / bold) ----
  // xlsx (community build) preserves cell.s through write; WPS/Excel-for-Mac
  // render them. LibreOffice may ignore some properties.
  const thinBorder = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  };
  const applyStyle = (r: number, c: number, style: Record<string, unknown>) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr] || { t: "s", v: "" };
    cell.s = { ...(cell.s || {}), ...style };
    ws[addr] = cell;
  };
  for (const { r, c } of borderedCells) {
    applyStyle(r, c, { border: thinBorder, alignment: { vertical: "center", wrapText: true } });
  }
  for (const { r, c } of headerCells) {
    applyStyle(r, c, {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "F2F2F2" }, patternType: "solid" },
    });
  }
  for (const { r, c } of titleCells) {
    applyStyle(r, c, {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "center", vertical: "center" },
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, template.name?.slice(0, 28) || "单据");

  const date = new Date().toISOString().split('T')[0];
  const exportFilename = filename || `${template.name}_${date}.xlsx`;
  XLSX.writeFile(wb, exportFilename);
}

// Export ProcessResult to Excel
export function exportProcessResultToExcel(
  result: ProcessResult,
  templateName?: string
): void {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Summary info
  if (result.summary) {
    const summaryData = Object.entries(result.summary)
      .filter(([, value]) => value)
      .map(([key, value]) => ({
        '字段': translateSummaryKey(key),
        '值': value
      }));
    if (summaryData.length > 0) {
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, '摘要信息');
    }
  }
  
  // Sheet 2: Table data
  if (result.headers.length > 0 && result.rows.length > 0) {
    const tableData = result.rows.map((row, index) => {
      const rowData: Record<string, string | number> = { '序号': index + 1 };
      result.headers.forEach(header => {
        rowData[header] = row[header] || '';
      });
      return rowData;
    });
    const wsTable = XLSX.utils.json_to_sheet(tableData);
    
    // Set column widths
    const colWidths = [{ wch: 6 }];
    result.headers.forEach(() => {
      colWidths.push({ wch: 15 });
    });
    wsTable['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, wsTable, '明细数据');
  }
  
  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `${templateName || '财务表单'}_${date}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

// Export to CSV
export function exportToCSV(
  headers: string[],
  rows: Record<string, string>[],
  filename: string
): void {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => 
    headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const csv = '\uFEFF' + headerLine + '\n' + dataLines;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// Export to JSON
export function exportToJSON(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

// Helper: Download blob
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: Translate summary keys to Chinese
function translateSummaryKey(key: string): string {
  const map: Record<string, string> = {
    totalAmount: '总金额',
    documentDate: '单据日期',
    supplier: '供应商/客户',
    documentType: '单据类型',
    documentNumber: '单据编号',
    contact: '联系电话',
    address: '地址',
  };
  return map[key] || key;
}

// Get recommended export format based on data type
export function getRecommendedFormat(hasTableData: boolean): ExportFormat {
  return hasTableData ? 'excel' : 'json';
}
