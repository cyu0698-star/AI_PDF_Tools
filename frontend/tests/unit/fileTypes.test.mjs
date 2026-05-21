import test from "node:test";
import assert from "node:assert/strict";
import {
  isPdfMimeType,
  isSupportedTemplateExtractMimeType,
  isSupportedVisionImageMimeType,
  normalizeMimeType,
  validateTemplateExtractMimeType,
} from "../../src/server/layout/fileTypes.mjs";

test("normalizeMimeType trims and lowercases", () => {
  assert.equal(normalizeMimeType("  IMAGE/PNG "), "image/png");
});

test("isPdfMimeType identifies only application/pdf", () => {
  assert.equal(isPdfMimeType("application/pdf"), true);
  assert.equal(isPdfMimeType("APPLICATION/PDF"), true);
  assert.equal(isPdfMimeType("image/png"), false);
});

test("vision image mime support checks", () => {
  assert.equal(isSupportedVisionImageMimeType("image/jpeg"), true);
  assert.equal(isSupportedVisionImageMimeType("image/png"), true);
  assert.equal(isSupportedVisionImageMimeType("image/webp"), true);
  assert.equal(isSupportedVisionImageMimeType("application/pdf"), false);
});

test("template extract mime support checks", () => {
  assert.equal(isSupportedTemplateExtractMimeType("application/pdf"), true);
  assert.equal(isSupportedTemplateExtractMimeType("image/jpg"), true);
  assert.equal(
    isSupportedTemplateExtractMimeType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ),
    false
  );
});

test("validateTemplateExtractMimeType returns clear errors", () => {
  const ok = validateTemplateExtractMimeType("image/png");
  assert.equal(ok.ok, true);

  const fail = validateTemplateExtractMimeType(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  assert.equal(fail.ok, false);
  assert.equal(fail.code, "UNSUPPORTED_MIME_TYPE");
  assert.match(fail.message, /仅支持 PDF 或图片/);
});
