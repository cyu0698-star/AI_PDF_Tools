import { getOcrTokens } from "../ocr/provider.mjs";

export async function parseElectronicPdfLayout({
  fileBase64,
  mimeType,
  sourceType,
  clientTokens,
}) {
  if (!fileBase64 || !mimeType) {
    throw new Error("electronic_pdf pipeline input is invalid");
  }

  const ocrResult = await getOcrTokens({
    fileBase64,
    mimeType,
    sourceType: sourceType || "electronic_pdf",
    clientTokens,
  });

  return {
    pipeline: "electronic_pdf",
    provider: ocrResult.provider,
    tokens: ocrResult.tokens,
    warnings: ocrResult.warnings || [],
    metadata: {
      extractedTextBlocks: Array.isArray(ocrResult.tokens) ? ocrResult.tokens.length : 0,
      extractedFonts: 0,
    },
  };
}
