import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl } from "@/lib/backendUrl.mjs";

export const runtime = "nodejs";

const PYTHON_BACKEND_URL = backendBaseUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType, templateBase64, templateMimeType } = body as {
      fileBase64: string;
      mimeType: string;
      templateBase64?: string;
      templateMimeType?: string;
    };

    if (!fileBase64 || !mimeType) {
      return NextResponse.json(
        { error: "缺少必要参数：fileBase64, mimeType" },
        { status: 400 }
      );
    }

    if (!PYTHON_BACKEND_URL) {
      return NextResponse.json(
        { error: "未配置 PYTHON_BACKEND_URL，智能转换需要 Python 后端支持" },
        { status: 501 }
      );
    }

    const payload: Record<string, string> = { fileBase64, mimeType };
    if (templateBase64) payload.templateBase64 = templateBase64;
    if (templateMimeType) payload.templateMimeType = templateMimeType;

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Try to parse error detail from backend
      try {
        const errData = await response.json();
        return NextResponse.json(
          { error: errData.detail || errData.error || "转换失败" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { error: `转换失败 (${response.status})` },
          { status: response.status }
        );
      }
    }

    // Stream the xlsx binary back to the client
    const blob = await response.arrayBuffer();
    const contentDisposition =
      response.headers.get("Content-Disposition") ||
      'attachment; filename="output.xlsx"';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    console.error("Convert proxy error:", error);
    const message =
      error instanceof Error ? error.message : "智能转换失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
