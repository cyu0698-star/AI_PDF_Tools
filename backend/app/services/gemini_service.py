import json
import re
from typing import Any

from fastapi import HTTPException
from google import genai

from app.core.prompts import TEMPLATE_PROMPTS


def process_document_with_gemini(
    client: genai.Client | None,
    file_base64: str,
    mime_type: str,
    template_type: str,
) -> dict[str, Any]:
    if not client:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY 未配置，请先在 .env 中设置后重启服务",
        )

    if template_type not in TEMPLATE_PROMPTS:
        raise HTTPException(status_code=400, detail=f"不支持的模板类型: {template_type}")

    prompt = TEMPLATE_PROMPTS[template_type]

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {"data": file_base64, "mime_type": mime_type}},
                        {"text": prompt},
                    ],
                }
            ],
        )

        text = response.text
        json_match = re.search(r"\{[\s\S]*\}", text)
        if not json_match:
            raise HTTPException(status_code=500, detail="AI 未能返回有效的结构化数据")

        parsed = json.loads(json_match.group())
        return {
            "headers": parsed.get("headers", []),
            "rows": parsed.get("rows", []),
            "summary": parsed.get("summary", {}),
            "rawText": text,
        }

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="AI 返回的数据格式无法解析") from exc
    except HTTPException:
        raise
    except Exception as exc:
        error_msg = str(exc)
        if (
            "fetch failed" in error_msg
            or "getaddrinfo" in error_msg
            or "ETIMEDOUT" in error_msg
        ):
            error_msg = (
                "无法连接到 Google Gemini API。\n"
                "请确认：\n"
                "1) 已配置代理（在 .env 中设置 HTTP_PROXY）\n"
                "2) 或在可访问 Google 的网络环境下运行"
            )
        raise HTTPException(status_code=500, detail=error_msg) from exc


def test_gemini_connection(client: genai.Client | None) -> dict[str, Any]:
    if not client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY 未配置")

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents="请用一句话回答：1+1等于几？",
        )
        return {"success": True, "response": response.text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"API 测试失败: {str(exc)}") from exc
