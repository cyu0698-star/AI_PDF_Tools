from fastapi import APIRouter

from app.api.routes.convert import router as convert_router
from app.api.routes.document import router as document_router
from app.api.routes.ocr import router as ocr_router
from app.api.routes.system import router as system_router
from app.api.routes.template_extract import router as template_extract_router
from app.api.routes.ai_vision import router as ai_vision_router

api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(document_router)
api_router.include_router(ocr_router)
api_router.include_router(convert_router)
api_router.include_router(template_extract_router)
api_router.include_router(ai_vision_router)
