from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google import genai

from app.api.router import api_router
from app.core.config import configure_proxy, get_gemini_api_key
from app.services.ocr_service import warmup_ocr_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_proxy()

    # Initialize Gemini client
    api_key = get_gemini_api_key()
    if api_key:
        app.state.client = genai.Client(api_key=api_key)
        print("[Gemini] 客户端已初始化")
    else:
        app.state.client = None
        print("[警告] GEMINI_API_KEY 未配置，/api/process 和 /api/convert 将返回 500")

    engine = (os.getenv("OCR_ENGINE") or "openai").strip().lower()
    openai_base = (os.getenv("OCR_OPENAI_BASE_URL") or "").strip()
    openai_key = (os.getenv("OCR_OPENAI_API_KEY") or "").strip()
    if engine in ("openai", "openai_compatible", "openai-compatible") and (not openai_base or not openai_key):
        print("[警告] OCR_OPENAI_BASE_URL/OCR_OPENAI_API_KEY 未配置，/api/ocr 将返回 503")
    else:
        print(f"[OCR] 引擎已配置: {engine}")

    if engine == "paddle":
        print("[OCR] 开始预热 Paddle 模型...")
        try:
            warmup_ocr_engine()
            print("[OCR] Paddle 模型预热完成")
        except Exception as exc:
            print(f"[警告] Paddle 模型预热失败: {str(exc)}")

    yield


app = FastAPI(
    title="财务文件识别 API",
    description="使用 OpenAI-compatible OCR 处理财务文件",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
