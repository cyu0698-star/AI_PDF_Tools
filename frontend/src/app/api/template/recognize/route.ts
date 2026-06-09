import { NextRequest, NextResponse } from "next/server";
import { recognizeTemplateStructure } from "@/server/ai/kimi";
import { isSupportedVisionImageMimeType } from "@/server/layout/fileTypes.mjs";
import { serverTr } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType } = body as {
      fileBase64: string;
      mimeType: string;
    };

    if (!fileBase64 || !mimeType) {
      return NextResponse.json(
        { error: serverTr("缺少必要参数：fileBase64, mimeType") },
        { status: 400 }
      );
    }

    if (!isSupportedVisionImageMimeType(mimeType)) {
      return NextResponse.json(
        {
          error:
            `${serverTr("模板识别当前仅支持图片（JPG/PNG/WEBP）。收到类型")}: ${mimeType || "unknown"}`,
        },
        { status: 400 }
      );
    }

    const result = await recognizeTemplateStructure(fileBase64, mimeType);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Template recognition error:", error);

    let message =
      error instanceof Error ? error.message : serverTr("模板识别失败，请重试");

    if (
      message.includes("fetch failed") ||
      message.includes("getaddrinfo ENOTFOUND") ||
      message.includes("connect ETIMEDOUT")
    ) {
      message = serverTr("无法连接到 AI API，请检查网络连接后重试。");
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
