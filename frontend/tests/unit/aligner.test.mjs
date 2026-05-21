import test from "node:test";
import assert from "node:assert/strict";
import {
  alignSemanticFieldsToTokens,
  applyAlignedBoxesToLayout,
} from "../../src/server/layout/aligner.mjs";

test("alignSemanticFieldsToTokens matches labels to best token", () => {
  const fields = [{ key: "invoiceDate", label: "开票日期" }];
  const tokens = [
    { text: "公司名称", bbox: { x: 10, y: 10, w: 80, h: 20 } },
    { text: "开票日期", bbox: { x: 30, y: 40, w: 88, h: 22 } },
  ];

  const result = alignSemanticFieldsToTokens(fields, tokens);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "invoiceDate");
  assert.equal(result[0].matchedToken.text, "开票日期");
  assert.equal(result[0].confidence, 1);
});

test("applyAlignedBoxesToLayout updates field label/value boxes", () => {
  const layout = {
    fields: [
      {
        key: "invoiceDate",
        label: "开票日期",
        confidence: 0,
        labelBox: null,
        valueBox: null,
      },
    ],
  };

  const mappings = [
    {
      key: "invoiceDate",
      confidence: 0.92,
      matchedToken: { text: "开票日期", bbox: { x: 20, y: 50, w: 90, h: 24 } },
      matchedValueToken: { text: "2026-02-28", bbox: { x: 130, y: 50, w: 120, h: 24 } },
    },
  ];

  const updated = applyAlignedBoxesToLayout(layout, mappings);
  assert.deepEqual(updated.fields[0].labelBox, { x: 20, y: 50, w: 90, h: 24 });
  assert.deepEqual(updated.fields[0].valueBox, { x: 130, y: 50, w: 120, h: 24 });
  assert.equal(updated.fields[0].confidence, 0.92);
});

test("alignSemanticFieldsToTokens finds nearby value token on same line", () => {
  const fields = [{ key: "companyName", label: "公司名称" }];
  const tokens = [
    { text: "公司名称", bbox: { x: 50, y: 120, w: 80, h: 20 } },
    { text: "惠州市罗丰实业有限公司", bbox: { x: 150, y: 120, w: 220, h: 20 } },
  ];
  const result = alignSemanticFieldsToTokens(fields, tokens);
  assert.equal(result[0].matchedToken.text, "公司名称");
  assert.equal(result[0].matchedValueToken.text, "惠州市罗丰实业有限公司");
});
