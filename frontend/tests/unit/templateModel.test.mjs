import test from "node:test";
import assert from "node:assert/strict";
import { buildTemplateModel } from "../../src/server/layout/templateModel.mjs";

test("buildTemplateModel extracts static labels and variable values", () => {
  const model = buildTemplateModel([
    { id: "t1", text: "公司名称：", bbox: { x: 10, y: 10, w: 60, h: 16 }, role: "fixed_text" },
    { id: "t2", text: "惠州市罗丰实业有限公司", bbox: { x: 76, y: 10, w: 200, h: 16 }, role: "fillable_value" },
    { id: "t3", text: "电话：", bbox: { x: 10, y: 34, w: 40, h: 16 }, role: "fixed_text" },
    { id: "t4", text: "0752-3731609", bbox: { x: 56, y: 34, w: 92, h: 16 }, role: "fillable_value" },
  ]);

  assert.equal(model.staticTokens.some((t) => t.text.includes("公司名称")), true);
  assert.equal(model.staticTokens.some((t) => t.text.includes("电话")), true);
  assert.equal(model.variableTokens.some((t) => t.text.includes("0752")), true);
});

test("buildTemplateModel rebuilds table headers and sample rows", () => {
  const model = buildTemplateModel([
    { id: "h1", text: "序号", bbox: { x: 10, y: 100, w: 30, h: 16 }, role: "table_header" },
    { id: "h2", text: "产品名称", bbox: { x: 80, y: 100, w: 70, h: 16 }, role: "table_header" },
    { id: "h3", text: "数量", bbox: { x: 180, y: 100, w: 40, h: 16 }, role: "table_header" },
    { id: "r1c1", text: "1", bbox: { x: 12, y: 126, w: 10, h: 16 }, role: "table_cell" },
    { id: "r1c2", text: "客制刹车轮", bbox: { x: 82, y: 126, w: 78, h: 16 }, role: "table_cell" },
    { id: "r1c3", text: "2", bbox: { x: 182, y: 126, w: 12, h: 16 }, role: "table_cell" },
  ]);

  assert.ok(model.table);
  assert.equal(model.table.columns.length, 3);
  assert.equal(model.table.columns[0].label, "序号");
  assert.equal(model.table.sampleRows.length >= 1, true);
});

