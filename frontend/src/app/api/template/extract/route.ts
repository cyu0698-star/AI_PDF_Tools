import { NextRequest, NextResponse } from "next/server";
import { extractDataToTemplate } from "@/server/ai/kimi";
import { validateTemplateExtractMimeType } from "@/server/layout/fileTypes.mjs";
import { getOcrTokens } from "@/server/layout/ocr/provider.mjs";
import { assessLayoutQuality } from "@/server/layout/quality.mjs";
import {
  normalizeClientOcrTokens,
  normalizeExtractedDataResult,
  normalizeTemplateLayout,
  normalizeTemplateStructureInput,
} from "@/server/layout/ir.mjs";
import {
  applyTransformToLayout,
  assessTransformQuality,
  estimateTemplateTransform,
} from "@/server/layout/transform.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType, templateStructure, templateLayout } = body as {
      fileBase64: string;
      mimeType: string;
      templateStructure: {
        companyInfo: { fields: Array<{ key: string; label: string }> };
        tableHeaders: string[];
        summaryFields: string[];
      };
      templateLayout?: {
        fields?: Array<{ key: string; label: string; confidence?: number }>;
      } | null;
      allowSemanticFallback?: boolean;
      strictAlignment?: boolean;
      ocrTokens?: Array<{
        text: string;
        bbox?: { x: number; y: number; w: number; h: number };
      }>;
    };
    const allowSemanticFallback = body?.allowSemanticFallback !== false;
    const strictAlignment = body?.strictAlignment === true;
    const requestOcrTokens = normalizeClientOcrTokens(body.ocrTokens);
    const normalizedTemplateStructure = normalizeTemplateStructureInput(templateStructure);
    const normalizedTemplateLayout = templateLayout
      ? normalizeTemplateLayout(templateLayout)
      : null;

    if (!fileBase64 || !mimeType || !templateStructure) {
      return NextResponse.json(
        { error: "缺少必要参数：fileBase64, mimeType, templateStructure" },
        { status: 400 }
      );
    }
    if (normalizedTemplateLayout) {
      const quality = assessLayoutQuality(normalizedTemplateLayout);
      if (!quality.isQualified) {
        if (!allowSemanticFallback || strictAlignment) {
        return NextResponse.json(
          {
            error:
              "模板质量不足，无法可靠提取。请重新创建模板并确保锚点覆盖率足够。",
            quality,
            extractionMode: "aligned",
          },
          { status: 422 }
        );
        }
      }
    }

    const mimeValidation = validateTemplateExtractMimeType(mimeType);
    if (!mimeValidation.ok) {
      console.warn(
        `[template/extract] blocked unsupported mimeType: ${mimeType}`
      );
      return NextResponse.json({ error: mimeValidation.message }, { status: 400 });
    }

    const ocrResult =
      requestOcrTokens.length > 0
        ? { tokens: requestOcrTokens, warnings: [] as string[] }
        : await getOcrTokens({
            fileBase64,
            mimeType,
            sourceType: mimeType === "application/pdf" ? "scanned_pdf" : "image",
          });
    const normalizedOcrTokens = normalizeClientOcrTokens(ocrResult.tokens);

    let effectiveTemplateLayout = normalizedTemplateLayout;
    let transform: ReturnType<typeof estimateTemplateTransform> | null = null;
    let transformQuality: ReturnType<typeof assessTransformQuality> | null = null;
    let extractionMode: "aligned" | "semantic_fallback" = "aligned";

    if (normalizedTemplateLayout && normalizedOcrTokens.length > 0) {
      transform = estimateTemplateTransform(normalizedTemplateLayout, normalizedOcrTokens);
      transformQuality = assessTransformQuality(transform);
      if (!transformQuality.isQualified) {
        if (allowSemanticFallback && !strictAlignment) {
          extractionMode = "semantic_fallback";
          effectiveTemplateLayout = null;
        } else {
        return NextResponse.json(
          {
            error: "模板与当前文档对齐失败，无法保证导出位置准确。",
            transform,
            transformQuality,
            ocrWarnings: ocrResult.warnings || [],
            extractionMode: "aligned",
          },
          { status: 422 }
        );
        }
      }
      if (transformQuality?.isQualified && transform?.matrix) {
        effectiveTemplateLayout = applyTransformToLayout(
          normalizedTemplateLayout,
          transform.matrix
        );
      }
    }

    const result = await extractDataToTemplate(
      fileBase64,
      mimeType,
      normalizedTemplateStructure,
      {
      templateLayout: effectiveTemplateLayout,
      ocrTokens: normalizedOcrTokens,
      }
    );
    const normalizedResult = normalizeExtractedDataResult(result);

    return NextResponse.json({
      ...normalizedResult,
      ocrWarnings: ocrResult.warnings || [],
      transform,
      transformQuality,
      extractionMode,
    });
  } catch (error) {
    console.error("Data extraction error:", error);

    let message =
      error instanceof Error ? error.message : "数据提取失败，请重试";

    if (
      message.includes("fetch failed") ||
      message.includes("getaddrinfo ENOTFOUND") ||
      message.includes("connect ETIMEDOUT")
    ) {
      message =
        "无法连接到 AI API，请检查网络连接后重试。";
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
