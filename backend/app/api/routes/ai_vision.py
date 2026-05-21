"""POST /api/ai-vision — generic AI vision-with-prompt → parsed JSON.

Lets the frontend (Next.js server routes) reach Claude without hitting the
Anthropic Cloudflare block on Node.js fetch. The prompt is provided by the
caller; this endpoint just runs the AI call and JSON parsing.

Used by:
- frontend kimi.ts `recognizeTemplateStructure`  (template structure recog)
- frontend kimi.ts `classifyTemplateTokensByVision`  (OCR token role classify)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.claude_service import extract_with_ai, is_ai_proxy_configured


router = APIRouter()


class AIVisionRequest(BaseModel):
    fileBase64: str
    mimeType: str
    prompt: str
    maxTokens: int = Field(default=4096, ge=128, le=32000)


@router.post("/api/ai-vision")
async def ai_vision(payload: AIVisionRequest) -> dict[str, Any]:
    if not is_ai_proxy_configured():
        raise HTTPException(status_code=500, detail="AI_API_KEY 未配置")

    try:
        parsed = extract_with_ai(payload.fileBase64, payload.mimeType, payload.prompt)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="AI 返回的数据格式无法解析") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"result": parsed}
