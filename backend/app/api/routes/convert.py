"""POST /api/convert — one-shot PDF-to-Excel conversion via Claude or Gemini."""

from __future__ import annotations

import base64
import json
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.prompts import CONVERT_PROMPT, TEMPLATE_FILL_PROMPT
from app.services.claude_service import extract_with_ai, is_ai_proxy_configured
from app.services.excel_builder import build_excel
from app.services.template_filler import fill_template, serialize_template


router = APIRouter()


class ConvertRequest(BaseModel):
    fileBase64: str
    mimeType: str
    templateBase64: str | None = None
    templateMimeType: str | None = None


@router.post("/api/convert")
async def convert_document(request: ConvertRequest, fastapi_request: Request):
    has_template = bool(request.templateBase64)

    # --- Determine prompt ---
    if has_template:
        template_bytes = base64.b64decode(request.templateBase64)
        try:
            template_desc = serialize_template(template_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"无法解析 Excel 模板: {exc}"
            ) from exc
        prompt = TEMPLATE_FILL_PROMPT.replace("{template_structure}", template_desc)
    else:
        prompt = CONVERT_PROMPT

    # 1. Extract document structure via AI
    structured: dict[str, Any]

    if is_ai_proxy_configured():
        # Prefer OpenAI-compatible proxy (Gemini / Claude / etc.)
        try:
            structured = extract_with_ai(
                request.fileBase64, request.mimeType, prompt
            )
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=500, detail="AI 返回的数据格式无法解析") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    else:
        # Fallback to Gemini
        client = fastapi_request.app.state.client
        if not client:
            raise HTTPException(
                status_code=500,
                detail="未配置任何 AI 后端。请在 .env 中设置 CLAUDE_API_KEY 或 GEMINI_API_KEY",
            )
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {"inline_data": {"data": request.fileBase64, "mime_type": request.mimeType}},
                            {"text": prompt},
                        ],
                    }
                ],
            )
            text = response.text
        except Exception as exc:
            error_msg = str(exc)
            if any(kw in error_msg for kw in ("fetch failed", "getaddrinfo", "ETIMEDOUT")):
                error_msg = "无法连接到 Google Gemini API。请检查网络或代理配置。"
            raise HTTPException(status_code=500, detail=error_msg) from exc

        json_match = re.search(r"\{[\s\S]*\}", text)
        if not json_match:
            raise HTTPException(status_code=500, detail="AI 未能返回有效的结构化数据")
        try:
            structured = json.loads(json_match.group())
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=500, detail="AI 返回的数据格式无法解析") from exc

    # 2. Build Excel
    if has_template:
        # Fill the user's template with AI-extracted mapping
        try:
            xlsx_bytes = fill_template(template_bytes, structured)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"模板填充失败: {exc}") from exc
        filename = "filled_template.xlsx"
    else:
        # Original path: generate Excel from scratch
        try:
            xlsx_bytes = build_excel(structured)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Excel 生成失败: {exc}") from exc

        title = (structured.get("title") or "output").strip()
        safe_title = re.sub(r'[\\/:*?"<>|]', "_", title)
        filename = f"{safe_title}.xlsx"

    # 3. Return as downloadable file
    from urllib.parse import quote
    ascii_fallback = "output.xlsx"
    utf8_filename = quote(filename)
    disposition = f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{utf8_filename}"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": disposition},
    )
