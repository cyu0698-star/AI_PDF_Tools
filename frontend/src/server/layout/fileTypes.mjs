export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const SUPPORTED_TEMPLATE_EXTRACT_MIME_TYPES = new Set([
  "application/pdf",
  ...SUPPORTED_IMAGE_MIME_TYPES,
]);

export function normalizeMimeType(mimeType) {
  return (mimeType || "").toLowerCase().trim();
}

export function isPdfMimeType(mimeType) {
  return normalizeMimeType(mimeType) === "application/pdf";
}

export function isSupportedVisionImageMimeType(mimeType) {
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalizeMimeType(mimeType));
}

export function isSupportedTemplateExtractMimeType(mimeType) {
  return SUPPORTED_TEMPLATE_EXTRACT_MIME_TYPES.has(normalizeMimeType(mimeType));
}

export function validateTemplateExtractMimeType(mimeType) {
  if (isSupportedTemplateExtractMimeType(mimeType)) {
    return { ok: true };
  }

  const normalized = normalizeMimeType(mimeType);
  return {
    ok: false,
    code: "UNSUPPORTED_MIME_TYPE",
    message:
      `当前模板提取仅支持 PDF 或图片（JPG/PNG/WEBP）。` +
      `收到类型：${normalized || "unknown"}。` +
      `如需处理 Excel，请走 Excel 专用解析流程。`,
  };
}
