import { NextRequest, NextResponse } from "next/server";
import { analyzeTemplateLayout } from "@/server/layout/parser.mjs";
import {
  classifyTemplateTokensByVision,
  recognizeTemplateStructure,
} from "@/server/ai/kimi";
import { assessLayoutQuality, buildLayoutDiagnostics } from "@/server/layout/quality.mjs";
import { buildTemplateModel } from "@/server/layout/templateModel.mjs";
import {
  normalizeClientOcrTokens,
  normalizeTemplateLayout,
  normalizeTemplateModel,
  normalizeTemplateRecognitionResult,
} from "@/server/layout/ir.mjs";
import { serverTr } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType, templateName, ocrTokens } = body as {
      fileBase64: string;
      mimeType: string;
      templateName?: string;
      ocrTokens?: Array<{
        text: string;
        bbox?: { x: number; y: number; w: number; h: number };
      }>;
    };

    if (!fileBase64 || !mimeType) {
      return NextResponse.json(
        { error: serverTr("缺少必要参数：fileBase64, mimeType") },
        { status: 400 }
      );
    }

    let recognizedStructure = {
      companyInfo: { fields: [] as Array<{ key: string; label: string; type: "text" | "number" | "date"; required: boolean }> },
      tableHeaders: [] as string[],
      tableFieldTypes: [] as string[],
      summaryFields: [] as string[],
    };

    if (mimeType.startsWith("image/")) {
      recognizedStructure = normalizeTemplateRecognitionResult(
        await recognizeTemplateStructure(fileBase64, mimeType)
      );
    }

    const templateLayoutRaw = await analyzeTemplateLayout({
      fileBase64,
      mimeType,
      templateName,
      ocrTokens: normalizeClientOcrTokens(ocrTokens),
      semanticAnalyzer: async () => {
        return recognizedStructure;
      },
    });
    const templateLayout = normalizeTemplateLayout(templateLayoutRaw);
    const mutableLayout = templateLayout as {
      tokens: Array<{
        id: string;
        text: string;
        bbox: { x: number; y: number; w: number; h: number };
        role: "fixed_text" | "fillable_value" | "table_header" | "table_cell" | "unknown";
      }>;
      warnings: string[];
      meta?: { parserVersion?: string };
    };
    // Stage 2: visual-semantic filtering over full OCR tokens.
    // Goal: keep template-fixed text and mark variable data tokens.
    if (mimeType.startsWith("image/") && Array.isArray(mutableLayout?.tokens) && mutableLayout.tokens.length > 0) {
      try {
        const semantic = await classifyTemplateTokensByVision(
          fileBase64,
          mimeType,
          mutableLayout.tokens
        );

        const fixedSet = new Set(semantic.fixedTokenIds);
        const variableSet = new Set(semantic.variableTokenIds);
        const tableHeaderSet = new Set(semantic.tableHeaderTokenIds);

        mutableLayout.tokens = mutableLayout.tokens.map((token) => {
          if (tableHeaderSet.has(token.id)) return { ...token, role: "table_header" as const };
          if (fixedSet.has(token.id)) return { ...token, role: "fixed_text" as const };
          if (variableSet.has(token.id)) return { ...token, role: "fillable_value" as const };
          return token;
        });

        mutableLayout.meta = {
          ...mutableLayout.meta,
          parserVersion: `${mutableLayout.meta?.parserVersion || "phase3-skeleton"}+vision_semantic`,
        };
      } catch (semanticErr) {
        const msg = semanticErr instanceof Error ? semanticErr.message : String(semanticErr);
        const warningList = Array.isArray(mutableLayout.warnings)
          ? (mutableLayout.warnings as string[])
          : [];
        warningList.push(`vision_semantic_failed:${msg.slice(0, 80)}`);
        mutableLayout.warnings = warningList;
      }
    }

    const templateModel = normalizeTemplateModel(
      buildTemplateModel(templateLayout.tokens)
    );
    const quality = assessLayoutQuality(templateLayout);
    const diagnostics = buildLayoutDiagnostics(templateLayout, quality);
    const warningList = Array.isArray(templateLayout.warnings)
      ? (templateLayout.warnings as string[])
      : [];
    const ocrWarnings = warningList.filter(
          (w) =>
            w.startsWith("ocr_http_non_200:") ||
            w.startsWith("ocr_http_timeout") ||
            w.startsWith("ocr_http_request_failed") ||
            w.startsWith("ocr_provider_unsupported") ||
            w.startsWith("ocr_http_url_missing")
        );

    // Fail fast when OCR upstream is unavailable, so UI shows explicit error
    // instead of an empty template preview.
    if (templateLayout.ocrTokenCount === 0 && ocrWarnings.length > 0) {
      return NextResponse.json(
        {
          error: `${serverTr("OCR 服务不可用")}: ${ocrWarnings[0]}`,
          ocrWarnings,
          diagnostics,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      templateLayout,
      templateModel,
      recognizedStructure,
      warnings: templateLayout.warnings,
      confidence: templateLayout.confidence,
      quality,
      diagnostics,
    });
  } catch (error) {
    console.error("Template analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : serverTr("模板分析失败") },
      { status: 500 }
    );
  }
}
