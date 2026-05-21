import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/server/ai/kimi";
import { TemplateType } from "@/features/documents/types";
import { validateTemplateExtractMimeType } from "@/server/layout/fileTypes.mjs";
import { backendBaseUrl } from "@/lib/backendUrl.mjs";

// 确保使用 Node.js 运行时，避免 edge 环境下某些网络限制
export const runtime = "nodejs";

// Python 后端 URL（设置后会使用 Python 后端，否则使用内置的 Node.js 处理）
const PYTHON_BACKEND_URL = backendBaseUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType, templateType } = body as {
      fileBase64: string;
      mimeType: string;
      templateType: TemplateType;
    };

    if (!fileBase64 || !mimeType || !templateType) {
      return NextResponse.json(
        { error: "缺少必要参数：fileBase64, mimeType, templateType" },
        { status: 400 }
      );
    }

    // 如果配置了 Python 后端，则转发请求
    if (PYTHON_BACKEND_URL) {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType, templateType }),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.detail || data.error || "Python 后端处理失败" },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    }

    const mimeValidation = validateTemplateExtractMimeType(mimeType);
    if (!mimeValidation.ok) {
      console.warn(`[process] blocked unsupported mimeType: ${mimeType}`);
      return NextResponse.json({ error: mimeValidation.message }, { status: 400 });
    }

    // 使用内置的 Node.js 处理
    const result = await processDocument(fileBase64, mimeType, templateType);

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI processing error:", error);

    let message =
      error instanceof Error ? error.message : "AI 处理失败，请重试";

    // 网络错误处理
    if (
      message.includes("fetch failed") ||
      message.includes("getaddrinfo ENOTFOUND") ||
      message.includes("connect ETIMEDOUT")
    ) {
      message =
        "无法连接到 Kimi API：当前运行环境的网络访问不到 api.moonshot.cn。\n" +
        "请确认：\n" +
        "1）检查网络连接是否正常；\n" +
        "2）确认 API Key 是否有效；\n" +
        "3）尝试稍后重试。";
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
