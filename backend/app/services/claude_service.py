"""Call Anthropic Claude API natively to extract document structure."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx


def _get_config() -> tuple[str, str, str]:
    api_key = (os.getenv("AI_API_KEY") or "").strip()
    base_url = (os.getenv("AI_BASE_URL") or "https://api.anthropic.com").strip().rstrip("/")
    model = (os.getenv("AI_MODEL") or "claude-sonnet-4-5").strip()
    return api_key, base_url, model


def is_ai_proxy_configured() -> bool:
    api_key, _base_url, _model = _get_config()
    return bool(api_key)


def extract_with_ai(file_base64: str, mime_type: str, prompt: str) -> dict[str, Any]:
    """Send a file + prompt to Anthropic Claude (native /v1/messages) and return parsed JSON."""
    api_key, base_url, model = _get_config()
    if not api_key:
        raise RuntimeError("AI_API_KEY 未配置")

    # Anthropic supports PDF as a "document" block and images as "image" blocks.
    if mime_type == "application/pdf":
        file_part: dict[str, Any] = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": file_base64,
            },
        }
    else:
        file_part = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type or "image/png",
                "data": file_base64,
            },
        }

    payload = {
        "model": model,
        "max_tokens": 16384,
        # temperature=0 dramatically reduces hallucination in structured
        # extraction tasks (numbers, addresses, placeholder text leaks).
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    file_part,
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    with httpx.Client(timeout=180) as client:
        resp = client.post(f"{base_url}/v1/messages", json=payload, headers=headers)

    if resp.status_code != 200:
        detail = resp.text[:500]
        raise RuntimeError(f"AI API 返回 {resp.status_code}: {detail}")

    body = resp.json()

    # Anthropic native: body.content is a list of blocks; pick the first text block.
    text = ""
    for block in body.get("content", []) or []:
        if isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text", "") or ""
            if text:
                break

    if not text:
        raise RuntimeError("AI API 返回了空内容")

    # Parse JSON – try ```json fenced block first, then bare braces.
    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fenced:
        raw_json = fenced.group(1)
    else:
        bare = re.search(r"\{[\s\S]*\}", text)
        if not bare:
            raise RuntimeError("AI 未能返回有效的结构化 JSON")
        raw_json = bare.group()

    # Attempt repair: strip trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", raw_json)

    return json.loads(cleaned)
