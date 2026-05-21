import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeClientOcrTokens,
  normalizeExtractedDataResult,
  normalizeTemplateLayout,
  normalizeTemplateRecognitionResult,
} from "../../src/server/layout/ir.mjs";

test("normalizeTemplateRecognitionResult coerces malformed fields into safe arrays", () => {
  const normalized = normalizeTemplateRecognitionResult({
    companyInfo: { fields: { foo: "bar" } },
    tableHeaders: ["序号", "产品名称", 123],
    tableFieldTypes: ["number"],
    summaryFields: "bad",
  });

  assert.deepEqual(normalized.companyInfo.fields, []);
  assert.deepEqual(normalized.tableHeaders, ["序号", "产品名称"]);
  assert.deepEqual(normalized.tableFieldTypes, ["number", "text"]);
  assert.deepEqual(normalized.summaryFields, []);
});

test("normalizeTemplateLayout removes invalid tokens and normalizes layout defaults", () => {
  const layout = normalizeTemplateLayout({
    templateName: "T1",
    tokens: [
      { id: "a", text: "公司名称", bbox: { x: 1, y: 2, w: 10, h: 10 }, role: "fixed_text" },
      { id: "b", text: "", bbox: { x: 1, y: 2, w: 10, h: 10 } },
      { id: "c", text: "坏框", bbox: { x: 1, y: 2, w: 0, h: 10 } },
    ],
    fields: [{ key: "company", label: "公司", semanticType: "text" }],
    table: { columns: [{ label: "列A" }] },
    warnings: [123, "ok"],
  });

  assert.equal(layout.tokens.length, 1);
  assert.equal(layout.tokens[0].id, "a");
  assert.equal(layout.fields.length, 1);
  assert.equal(layout.table.columns.length, 1);
  assert.deepEqual(layout.warnings, ["ok"]);
});

test("normalizeClientOcrTokens keeps valid text tokens and optional bbox", () => {
  const tokens = normalizeClientOcrTokens([
    { text: "A", bbox: { x: 1, y: 2, w: 3, h: 4 } },
    { text: " B " },
    { text: "" },
    { bad: true },
  ]);

  assert.equal(tokens.length, 2);
  assert.deepEqual(tokens[0], { text: "A", bbox: { x: 1, y: 2, w: 3, h: 4 } });
  assert.deepEqual(tokens[1], { text: "B" });
});

test("normalizeExtractedDataResult stringifies values and trims invalid confidence fields", () => {
  const result = normalizeExtractedDataResult({
    companyInfo: { name: "A", phone: 1234 },
    tableRows: [{ qty: 2, note: null }],
    summary: { total: 100 },
    lowConfidenceFields: [{ key: "companyName", confidence: 1.3 }, { confidence: 0.2 }],
  });

  assert.deepEqual(result.companyInfo, { name: "A", phone: "1234" });
  assert.deepEqual(result.tableRows, [{ qty: "2", note: "" }]);
  assert.deepEqual(result.summary, { total: "100" });
  assert.deepEqual(result.lowConfidenceFields, [{ key: "companyName", confidence: 1 }]);
});
