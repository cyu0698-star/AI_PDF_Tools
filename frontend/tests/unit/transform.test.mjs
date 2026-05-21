import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTransformToLayout,
  assessTransformQuality,
  estimateTemplateTransform,
} from "../../src/server/layout/transform.mjs";

function makeTemplateLayout() {
  return {
    tokens: [
      { id: "t1", text: "送货单", role: "fixed_text", bbox: { x: 100, y: 100, w: 80, h: 20 } },
      { id: "t2", text: "客户名称", role: "fixed_text", bbox: { x: 100, y: 200, w: 90, h: 20 } },
      { id: "t3", text: "订单号", role: "table_header", bbox: { x: 300, y: 300, w: 90, h: 20 } },
    ],
    fields: [
      {
        key: "customerName",
        label: "客户名称",
        semanticType: "text",
        required: false,
        labelBox: { x: 100, y: 200, w: 90, h: 20 },
        valueBox: { x: 200, y: 200, w: 200, h: 20 },
        font: { family: null, size: null, weight: null, estimated: true },
        confidence: 0.9,
      },
    ],
    table: {
      columns: [{ key: "orderNo", label: "订单号", semanticType: "text", box: { x: 300, y: 300, w: 90, h: 20 } }],
      headerBox: { x: 260, y: 290, w: 300, h: 30 },
      dataRegionBox: { x: 260, y: 320, w: 300, h: 200 },
      repeatDirection: "down",
      rowHeight: 40,
    },
    summary: [],
    meta: {},
  };
}

test("estimateTemplateTransform returns affine transform for translated document tokens", () => {
  const layout = makeTemplateLayout();
  const docTokens = [
    { text: "送货单", bbox: { x: 115, y: 130, w: 80, h: 20 } },
    { text: "客户名称", bbox: { x: 115, y: 230, w: 90, h: 20 } },
    { text: "订单号", bbox: { x: 315, y: 330, w: 90, h: 20 } },
  ];

  const transform = estimateTemplateTransform(layout, docTokens);
  assert.equal(transform.ok, true);
  assert.ok(transform.matrix);
  assert.equal(transform.metrics.matchCount >= 3, true);
});

test("assessTransformQuality rejects poor transform", () => {
  const quality = assessTransformQuality({
    ok: false,
    failureCode: "anchor_matches_insufficient",
    metrics: { matchCount: 1, inlierCount: 0, inlierRatio: 0, reprojectionErrorPx: 99 },
  });
  assert.equal(quality.isQualified, false);
  assert.equal(quality.failures.length > 0, true);
});

test("applyTransformToLayout transforms field value box coordinates", () => {
  const layout = makeTemplateLayout();
  const matrix = [
    [1, 0, 10],
    [0, 1, 20],
  ];
  const transformed = applyTransformToLayout(layout, matrix);
  assert.equal(Math.round(transformed.fields[0].valueBox.x), 210);
  assert.equal(Math.round(transformed.fields[0].valueBox.y), 220);
});
