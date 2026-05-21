from fastapi import APIRouter, Request

from app.schemas.ocr import OcrRequest, OcrResponse
from app.services.ocr_service import extract_ocr_tokens_openai_only

router = APIRouter()


@router.post("/api/ocr", response_model=OcrResponse)
async def ocr_extract(request: OcrRequest, fastapi_request: Request):
    _ = fastapi_request
    result = extract_ocr_tokens_openai_only(
        file_base64=request.fileBase64,
        mime_type=request.mimeType,
    )
    return OcrResponse(**result)
