import { getOcrTokens } from "../ocr/provider.mjs";

export async function parseOcrLayout({
  fileBase64,
  mimeType,
  sourceType,
  clientTokens,
}) {
  if (!fileBase64 || !mimeType) {
    throw new Error("ocr pipeline input is invalid");
  }

  const ocrResult = await getOcrTokens({
    fileBase64,
    mimeType,
    sourceType,
    clientTokens,
  });

  return {
    pipeline: "ocr",
    provider: ocrResult.provider,
    tokens: ocrResult.tokens,
    warnings: ocrResult.warnings,
    metadata: {
      tokenCount: Array.isArray(ocrResult.tokens) ? ocrResult.tokens.length : 0,
    },
  };
}
