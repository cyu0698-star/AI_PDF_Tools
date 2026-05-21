import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTemplateLayout,
  inferPdfNature,
} from "../../src/server/layout/parser.mjs";

test("analyzeTemplateLayout builds normalized layout skeleton", async () => {
  const layout = await analyzeTemplateLayout({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    templateName: "测试模板",
    semanticAnalyzer: async () => ({
      companyInfo: {
        fields: [{ key: "companyName", label: "公司名称", type: "text", required: true }],
      },
      tableHeaders: ["货物名称", "数量"],
      tableFieldTypes: ["text", "number"],
      summaryFields: ["合计金额"],
    }),
    ocrTokens: [{ text: "公司名称", bbox: { x: 10, y: 12, w: 80, h: 24 } }],
  });

  assert.equal(layout.templateName, "测试模板");
  assert.equal(layout.sourceType, "image");
  assert.equal(layout.meta.pipeline, "ocr");
  assert.equal(layout.fields.length, 1);
  assert.equal(layout.table.columns.length, 2);
  assert.equal(layout.summary.length, 1);
  assert.ok(layout.confidence >= 0);
});

test("inferPdfNature detects likely electronic pdf snippets", () => {
  const fakePdf = Buffer.from("%PDF-1.7 /Font BT", "latin1").toString("base64");
  assert.equal(inferPdfNature(fakePdf), "electronic");
});

test("analyzeTemplateLayout chooses electronic_pdf pipeline when pdf seems electronic", async () => {
  const fakePdf = Buffer.from("%PDF-1.7 /Font BT", "latin1").toString("base64");

  const layout = await analyzeTemplateLayout({
    fileBase64: fakePdf,
    mimeType: "application/pdf",
    semanticAnalyzer: async () => ({
      companyInfo: { fields: [] },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    pipelines: {
      electronicPdf: async () => ({
        pipeline: "electronic_pdf",
        tokens: [],
        warnings: ["electronic_pdf_pipeline_skeleton"],
      }),
      ocr: async () => {
        throw new Error("ocr pipeline should not be called");
      },
    },
  });

  assert.equal(layout.sourceType, "electronic_pdf");
  assert.equal(layout.meta.pipeline, "electronic_pdf");
  assert.equal(layout.meta.pdfNature, "electronic");
});

test("analyzeTemplateLayout electronic pdf uses tokens to build anchors", async () => {
  const fakePdf = Buffer.from("%PDF-1.7 /Font BT", "latin1").toString("base64");
  const layout = await analyzeTemplateLayout({
    fileBase64: fakePdf,
    mimeType: "application/pdf",
    semanticAnalyzer: async () => ({
      companyInfo: {
        fields: [{ key: "companyName", label: "公司名称", type: "text", required: true }],
      },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    ocrTokens: [{ text: "公司名称", bbox: { x: 12, y: 22, w: 66, h: 18 } }],
  });

  assert.equal(layout.sourceType, "electronic_pdf");
  assert.equal(layout.meta.pipeline, "electronic_pdf");
  assert.equal(layout.ocrTokenCount, 1);
  assert.deepEqual(layout.fields[0].labelBox, { x: 12, y: 22, w: 66, h: 18 });
});

test("analyzeTemplateLayout infers semantic fields from OCR tokens when semantic is empty", async () => {
  const layout = await analyzeTemplateLayout({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    semanticAnalyzer: async () => ({
      companyInfo: { fields: [] },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    ocrTokens: [
      { text: "公司名称", bbox: { x: 10, y: 10, w: 60, h: 16 } },
      { text: "惠州某某有限公司", bbox: { x: 90, y: 10, w: 200, h: 16 } },
    ],
  });

  assert.ok(layout.fields.length >= 1);
  assert.equal(layout.warnings.includes("no_ocr_tokens_provided"), false);
  assert.ok(Array.isArray(layout.tokens));
  assert.ok(layout.tokens.length >= 2);
  assert.ok(typeof layout.tokens[0].role === "string");
});

test("analyzeTemplateLayout splits composite OCR token into sub tokens", async () => {
  const layout = await analyzeTemplateLayout({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    semanticAnalyzer: async () => ({
      companyInfo: { fields: [] },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    ocrTokens: [
      {
        text: "公司名称惠州市罗丰实业有限公司地址广东省惠州市惠阳区电话0752-3731609",
        bbox: { x: 10, y: 10, w: 420, h: 22 },
      },
    ],
  });

  assert.ok(layout.tokens.length >= 3);
  assert.ok(layout.tokens.some((t) => t.text.includes("公司名称")));
  assert.ok(layout.tokens.some((t) => t.text.includes("地址")));
});

test("analyzeTemplateLayout splits label-value token by colon", async () => {
  const layout = await analyzeTemplateLayout({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    semanticAnalyzer: async () => ({
      companyInfo: { fields: [] },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    ocrTokens: [
      {
        text: "地址：广东省惠州市惠阳区秋长镇白石村",
        bbox: { x: 20, y: 30, w: 320, h: 20 },
      },
    ],
  });

  assert.ok(layout.tokens.some((t) => t.text.startsWith("地址")));
  assert.ok(layout.tokens.some((t) => t.text.includes("广东省惠州市")));
});

test("analyzeTemplateLayout uses pipeline tokens when explicit ocrTokens absent", async () => {
  const layout = await analyzeTemplateLayout({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    semanticAnalyzer: async () => ({
      companyInfo: {
        fields: [{ key: "companyName", label: "公司名称", type: "text", required: true }],
      },
      tableHeaders: [],
      tableFieldTypes: [],
      summaryFields: [],
    }),
    pipelines: {
      electronicPdf: async () => ({ pipeline: "electronic_pdf", tokens: [], warnings: [] }),
      ocr: async () => ({
        pipeline: "ocr",
        provider: "test-ocr",
        tokens: [{ text: "公司名称", bbox: { x: 1, y: 2, w: 30, h: 10 } }],
        warnings: [],
      }),
    },
  });

  assert.equal(layout.ocrTokenCount, 1);
  assert.deepEqual(layout.fields[0].labelBox, { x: 1, y: 2, w: 30, h: 10 });
  assert.equal(layout.meta.ocrProvider, "test-ocr");
  assert.equal(layout.meta.tokenSource, "pipeline");
});

test("analyzeTemplateLayout throws for unsupported mime", async () => {
  await assert.rejects(
    analyzeTemplateLayout({
      fileBase64: "ZmFrZQ==",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      semanticAnalyzer: async () => ({}),
    }),
    /不支持的模板文件类型/
  );
});
