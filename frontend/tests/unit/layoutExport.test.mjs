import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLayoutWritePlan,
  buildLayoutPreviewGrid,
  shouldUseLayoutExport,
} from "../../src/shared/utils/layoutExport.mjs";

test("shouldUseLayoutExport requires template layout fields", () => {
  assert.equal(shouldUseLayoutExport(null), false);
  assert.equal(
    shouldUseLayoutExport({ templateLayout: { fields: [] } }),
    false
  );
  assert.equal(
    shouldUseLayoutExport({
      templateLayout: {
        fields: [
          {
            key: "companyName",
            label: "公司名称",
            valueBox: { x: 1, y: 2, w: 3, h: 4 },
          },
        ],
      },
    }),
    true
  );
});

test("buildLayoutWritePlan maps company values into layout plan", () => {
  const plan = buildLayoutWritePlan(
    {
      fields: [
        {
          key: "companyName",
          label: "公司名称",
          confidence: 0.9,
          valueBox: { x: 100, y: 120, w: 220, h: 32 },
        },
      ],
    },
    { companyInfo: { companyName: "测试公司" } }
  );

  assert.equal(plan.length, 1);
  assert.equal(plan[0].key, "companyName");
  assert.equal(plan[0].value, "测试公司");
  assert.equal(plan[0].x, 100);
  assert.equal(plan[0].confidence, 0.9);
});

test("buildLayoutPreviewGrid places label and value based on coordinates", () => {
  const { matrix } = buildLayoutPreviewGrid([
    { label: "公司名称", value: "测试公司", x: 100, y: 100, w: 200, h: 30 },
    { label: "电话", value: "0752-0000", x: 100, y: 180, w: 180, h: 28 },
  ]);

  const flattened = matrix.flat().join("|");
  assert.match(flattened, /公司名称/);
  assert.match(flattened, /测试公司/);
  assert.match(flattened, /电话/);
  assert.match(flattened, /0752-0000/);
});
