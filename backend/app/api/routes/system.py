import os

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "财务文件识别 API", "status": "running"}


@router.get("/health")
async def health(request: Request):
    _ = request
    engine = (os.getenv("OCR_ENGINE") or "openai").strip().lower()
    openai_base = (os.getenv("OCR_OPENAI_BASE_URL") or "").strip()
    openai_key = (os.getenv("OCR_OPENAI_API_KEY") or "").strip()
    return {
        "status": "ok",
        "ocr_engine": engine,
        "ocr_openai_configured": bool(openai_base and openai_key),
    }
