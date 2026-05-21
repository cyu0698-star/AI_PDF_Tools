import test from "node:test";
import assert from "node:assert/strict";
import { buildLowConfidenceFields } from "../../src/server/layout/confidence.mjs";

test("buildLowConfidenceFields marks missing or weak fields", () => {
  const low = buildLowConfidenceFields({
    templateLayout: {
      fields: [
        { key: "companyName", label: "公司名称", confidence: 0.9 },
        { key: "invoiceDate", label: "开票日期", confidence: 0.2 },
      ],
    },
    companyInfo: {
      companyName: "测试公司",
      invoiceDate: "",
    },
    ocrTokens: [{ text: "公司名称", bbox: { x: 10, y: 10, w: 20, h: 10 } }],
    threshold: 0.65,
  });

  assert.equal(low.length, 1);
  assert.equal(low[0].key, "invoiceDate");
  assert.ok(low[0].confidence < 0.65);
});

test("buildLowConfidenceFields returns empty when no layout fields", () => {
  const low = buildLowConfidenceFields({
    templateLayout: { fields: [] },
    companyInfo: {},
    ocrTokens: [],
  });
  assert.deepEqual(low, []);
});
