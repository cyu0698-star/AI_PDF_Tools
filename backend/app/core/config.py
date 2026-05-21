import os
from dotenv import load_dotenv

load_dotenv()


def configure_proxy() -> None:
    http_proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
    if http_proxy:
        os.environ["HTTP_PROXY"] = http_proxy
        os.environ["HTTPS_PROXY"] = http_proxy


def get_gemini_api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY")
