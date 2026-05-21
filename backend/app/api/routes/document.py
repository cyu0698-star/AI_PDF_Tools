from fastapi import APIRouter, HTTPException, Request

from app.core.prompts import TEMPLATE_PROMPTS
from app.schemas.document import ProcessRequest, ProcessResponse
from app.services.claude_service import extract_with_ai, is_ai_proxy_configured
from app.services.gemini_service import (
    process_document_with_gemini,
    test_gemini_connection,
)

router = APIRouter()


@router.post("/api/process", response_model=ProcessResponse)
async def process_document(request: ProcessRequest, fastapi_request: Request):
    # Prefer Anthropic Claude (configured via AI_API_KEY); fall back to Gemini if not set.
    if is_ai_proxy_configured():
        if request.templateType not in TEMPLATE_PROMPTS:
            raise HTTPException(
                status_code=400, detail=f"不支持的模板类型: {request.templateType}"
            )
        prompt = TEMPLATE_PROMPTS[request.templateType]
        try:
            parsed = extract_with_ai(request.fileBase64, request.mimeType, prompt)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return ProcessResponse(
            headers=parsed.get("headers", []) or [],
            rows=parsed.get("rows", []) or [],
            summary=parsed.get("summary", {}) or {},
            rawText="",
        )

    client = fastapi_request.app.state.client
    result = process_document_with_gemini(
        client=client,
        file_base64=request.fileBase64,
        mime_type=request.mimeType,
        template_type=request.templateType,
    )
    return ProcessResponse(**result)


@router.post("/api/test")
async def test_gemini(fastapi_request: Request):
    return test_gemini_connection(fastapi_request.app.state.client)
