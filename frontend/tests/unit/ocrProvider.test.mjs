import test from "node:test";
import assert from "node:assert/strict";
import { getOcrTokens } from "../../src/server/layout/ocr/provider.mjs";

test("getOcrTokens prefers normalized client tokens", async () => {
  const result = await getOcrTokens({
    fileBase64: "ZmFrZQ==",
    mimeType: "image/png",
    sourceType: "image",
    clientTokens: [
      { text: "  公司名称  ", bbox: { x: 1, y: 2, w: 3, h: 4 } },
      { text: "   " },
    ],
  });

  assert.equal(result.provider, "client");
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].text, "公司名称");
});

test("getOcrTokens defaults to http provider without mock fallback", async () => {
  const originalProvider = process.env.OCR_PROVIDER;
  const originalUrl = process.env.OCR_HTTP_URL;
  try {
    process.env.OCR_PROVIDER = "";
    process.env.OCR_HTTP_URL = "";
    const result = await getOcrTokens({
      fileBase64: "ZmFrZQ==",
      mimeType: "image/png",
      sourceType: "image",
    });
    assert.equal(result.provider, "http");
    assert.deepEqual(result.tokens, []);
    assert.match(result.warnings.join(","), /ocr_http_url_missing/);
  } finally {
    process.env.OCR_PROVIDER = originalProvider;
    process.env.OCR_HTTP_URL = originalUrl;
  }
});

test("getOcrTokens http provider returns normalized tokens on success", async () => {
  const originalProvider = process.env.OCR_PROVIDER;
  const originalUrl = process.env.OCR_HTTP_URL;
  const originalFetch = globalThis.fetch;

  try {
    process.env.OCR_PROVIDER = "http";
    process.env.OCR_HTTP_URL = "http://localhost:9999/ocr";
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        tokens: [{ text: "  开票日期 ", bbox: { x: 1, y: 2, w: 3, h: 4 } }],
      }),
    });

    const result = await getOcrTokens({
      fileBase64: "ZmFrZQ==",
      mimeType: "image/png",
      sourceType: "image",
    });

    assert.equal(result.provider, "http");
    assert.equal(result.tokens.length, 1);
    assert.equal(result.tokens[0].text, "开票日期");
    assert.match(result.warnings.join(","), /ocr_http_tokens_used/);
  } finally {
    process.env.OCR_PROVIDER = originalProvider;
    process.env.OCR_HTTP_URL = originalUrl;
    globalThis.fetch = originalFetch;
  }
});

test("getOcrTokens http provider returns empty tokens on failure", async () => {
  const originalProvider = process.env.OCR_PROVIDER;
  const originalUrl = process.env.OCR_HTTP_URL;
  const originalFetch = globalThis.fetch;

  try {
    process.env.OCR_PROVIDER = "http";
    process.env.OCR_HTTP_URL = "http://localhost:9999/ocr";
    globalThis.fetch = async () => {
      throw new Error("network down");
    };

    const result = await getOcrTokens({
      fileBase64: "ZmFrZQ==",
      mimeType: "image/png",
      sourceType: "image",
    });

    assert.equal(result.provider, "http");
    assert.equal(result.tokens.length, 0);
    assert.match(result.warnings.join(","), /ocr_http_request_failed/);
  } finally {
    process.env.OCR_PROVIDER = originalProvider;
    process.env.OCR_HTTP_URL = originalUrl;
    globalThis.fetch = originalFetch;
  }
});
