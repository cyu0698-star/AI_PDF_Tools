import base64
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from typing import Any

import httpx
from fastapi import HTTPException

_PADDLE_OCR_INSTANCE = None


def _create_paddle_instance():
  from paddleocr import PaddleOCR  # type: ignore
  os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
  # Use mobile det/rec models to reduce memory pressure in containers.
  return PaddleOCR(
    lang="ch",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="PP-OCRv5_mobile_rec",
  )


def _parse_json_payload(text: str) -> dict[str, Any]:
  match = re.search(r"\{[\s\S]*\}", text or "")
  if not match:
    raise HTTPException(status_code=502, detail="OCR 模型未返回有效 JSON")
  try:
    payload = json.loads(match.group())
  except json.JSONDecodeError as exc:
    raise HTTPException(status_code=502, detail="OCR 模型返回 JSON 解析失败") from exc
  if not isinstance(payload, dict):
    raise HTTPException(status_code=502, detail="OCR 模型返回格式错误")
  return payload


def _to_num(value: Any) -> float:
  try:
    return float(value)
  except (TypeError, ValueError):
    return 0.0


def _extract_message_text(payload: dict[str, Any]) -> str:
  choices = payload.get("choices")
  if not isinstance(choices, list) or not choices:
    return ""
  first = choices[0] if isinstance(choices[0], dict) else {}
  message = first.get("message") if isinstance(first, dict) else {}
  if not isinstance(message, dict):
    return ""
  content = message.get("content")
  if isinstance(content, str):
    return content.strip()
  if isinstance(content, list):
    chunks: list[str] = []
    for item in content:
      if isinstance(item, str):
        chunks.append(item)
      elif isinstance(item, dict):
        text = item.get("text")
        if isinstance(text, str):
          chunks.append(text)
    return "\n".join(chunks).strip()
  return ""


def _normalize_tokens(raw_tokens: Any, warning_on_empty: str, provider: str) -> dict[str, Any]:
  if not isinstance(raw_tokens, list):
    raw_tokens = []
  tokens: list[dict[str, Any]] = []
  for token in raw_tokens[:1200]:
    if not isinstance(token, dict):
      continue
    token_text = str(token.get("text", "")).strip()
    if not token_text:
      continue
    bbox = token.get("bbox", {})
    if not isinstance(bbox, dict):
      bbox = {}
    x = max(0.0, _to_num(bbox.get("x")))
    y = max(0.0, _to_num(bbox.get("y")))
    w = max(0.0, _to_num(bbox.get("w")))
    h = max(0.0, _to_num(bbox.get("h")))
    confidence = min(1.0, max(0.0, _to_num(token.get("confidence"))))
    tokens.append(
      {
        "text": token_text,
        "bbox": {"x": x, "y": y, "w": w, "h": h},
        "confidence": confidence,
      }
    )
  return {
    "tokens": tokens,
    "provider": provider,
    "warnings": [] if tokens else [warning_on_empty],
  }


def _build_openai_payload_variants(
  file_base64: str, mime_type: str, model: str, prompt: str
) -> list[dict[str, Any]]:
  # Different OpenAI-compatible gateways accept different image_url schemas.
  return [
    {
      "model": model,
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{file_base64}"}},
            {"type": "text", "text": prompt},
          ],
        }
      ],
      "max_tokens": 4096,
    },
    {
      "model": model,
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "image_url", "image_url": f"data:{mime_type};base64,{file_base64}"},
            {"type": "text", "text": prompt},
          ],
        }
      ],
      "max_tokens": 4096,
    },
  ]


def _call_openai_compatible_ocr(file_base64: str, mime_type: str) -> dict[str, Any]:
  base_url = (os.getenv("OCR_OPENAI_BASE_URL") or "").strip()
  api_key = (os.getenv("OCR_OPENAI_API_KEY") or "").strip()
  model = (os.getenv("OCR_OPENAI_MODEL") or "gpt-4o-mini").strip()
  timeout_s = float(os.getenv("OCR_OPENAI_TIMEOUT_S") or "45")

  if not base_url or not api_key:
    raise HTTPException(status_code=503, detail="第三方 OCR 未配置：OCR_OPENAI_BASE_URL/OCR_OPENAI_API_KEY 缺失")

  endpoint = base_url.rstrip("/") + "/chat/completions"
  prompt = (
    "你是 OCR 引擎。请识别文档中可见文本并返回 JSON。"
    "只返回如下结构："
    '{"tokens":[{"text":"文本","bbox":{"x":0,"y":0,"w":0,"h":0},"confidence":0.0}]}。'
    "要求：bbox 使用原图像素坐标；x/y 为左上角；w/h 为宽高；confidence 在 0~1。"
    "不要输出额外解释。"
  )
  payload_variants = _build_openai_payload_variants(file_base64, mime_type, model, prompt)

  last_error = "未知错误"
  try:
    with httpx.Client(timeout=timeout_s) as client:
      for idx, payload in enumerate(payload_variants):
        response = client.post(
          endpoint,
          headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
          },
          json=payload,
        )

        if response.status_code >= 400:
          body = response.text[:400]
          last_error = f"{response.status_code} - {body}"
          # Retry next payload variant for common payload-compatibility errors.
          if (
            idx < len(payload_variants) - 1
            and ("Invalid image data" in body or "invalid image" in body.lower() or response.status_code in (400, 415, 422, 429))
          ):
            continue
          raise HTTPException(
            status_code=502,
            detail=f"第三方 OCR 上游错误: {response.status_code} - {body}",
          )

        try:
          response_payload = response.json()
        except Exception as exc:
          raise HTTPException(status_code=502, detail="第三方 OCR 返回非 JSON") from exc

        text = _extract_message_text(response_payload)
        parsed = _parse_json_payload(text)
        return _normalize_tokens(
          parsed.get("tokens", []),
          warning_on_empty="openai_ocr_empty_tokens",
          provider=f"openai-compatible:{model}",
        )
  except HTTPException:
    raise
  except Exception as exc:
    raise HTTPException(status_code=502, detail=f"第三方 OCR 请求失败: {str(exc)}") from exc

  raise HTTPException(status_code=502, detail=f"第三方 OCR 上游错误: {last_error}")


def _call_claude_ocr(file_base64: str, mime_type: str) -> dict[str, Any]:
  """OCR via Anthropic Claude (reuses AI_API_KEY from claude_service)."""
  api_key = (os.getenv("AI_API_KEY") or "").strip()
  base_url = (os.getenv("AI_BASE_URL") or "https://api.anthropic.com").strip().rstrip("/")
  model = (os.getenv("OCR_CLAUDE_MODEL") or os.getenv("AI_MODEL") or "claude-sonnet-4-5").strip()
  timeout_s = float(os.getenv("OCR_CLAUDE_TIMEOUT_S") or "120")

  if not api_key:
    raise HTTPException(
      status_code=503,
      detail="Claude OCR 未配置：AI_API_KEY 缺失",
    )

  # Claude supports image directly; PDFs need "document" block.
  if mime_type == "application/pdf":
    file_part: dict[str, Any] = {
      "type": "document",
      "source": {"type": "base64", "media_type": "application/pdf", "data": file_base64},
    }
  else:
    file_part = {
      "type": "image",
      "source": {"type": "base64", "media_type": mime_type or "image/png", "data": file_base64},
    }

  prompt = (
    "你是 OCR 引擎。请识别图片中所有可见文本，并返回 JSON。"
    "只返回如下结构（不要任何额外解释、不要 markdown 代码块）："
    '{"tokens":[{"text":"文本","bbox":{"x":0,"y":0,"w":0,"h":0},"confidence":0.0}]}。'
    "要求：bbox 使用原图像素坐标；x/y 为该文本块左上角；w/h 为该文本块宽高；"
    "confidence 在 0~1，不确定时填 0.8。尽量按行切分 token，每个 token 是一段独立可见文字。"
  )

  payload = {
    "model": model,
    "max_tokens": 8192,
    "messages": [
      {
        "role": "user",
        "content": [file_part, {"type": "text", "text": prompt}],
      }
    ],
  }
  headers = {
    "x-api-key": api_key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }

  try:
    with httpx.Client(timeout=timeout_s) as client:
      response = client.post(f"{base_url}/v1/messages", json=payload, headers=headers)
  except Exception as exc:
    raise HTTPException(status_code=502, detail=f"Claude OCR 请求失败: {str(exc)}") from exc

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Claude OCR 上游错误: {response.status_code} - {response.text[:400]}",
    )

  try:
    body = response.json()
  except Exception as exc:
    raise HTTPException(status_code=502, detail="Claude OCR 返回非 JSON") from exc

  text = ""
  for block in body.get("content", []) or []:
    if isinstance(block, dict) and block.get("type") == "text":
      text = block.get("text", "") or ""
      if text:
        break

  parsed = _parse_json_payload(text)
  return _normalize_tokens(
    parsed.get("tokens", []),
    warning_on_empty="claude_ocr_empty_tokens",
    provider=f"claude:{model}",
  )


def _decode_input_to_bgr(file_base64: str, mime_type: str):
  import cv2  # type: ignore
  import numpy as np  # type: ignore
  from PIL import Image  # type: ignore

  image_bytes = base64.b64decode(file_base64)

  if (mime_type or "").lower() == "application/pdf":
    try:
      import pypdfium2 as pdfium  # type: ignore
      pdf = pdfium.PdfDocument(io.BytesIO(image_bytes))
      if len(pdf) == 0:
        raise ValueError("PDF 无页面")
      page = pdf[0]
      bitmap = page.render(scale=2.0).to_pil()
      arr = np.array(bitmap.convert("RGB"))
      return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    except Exception as exc:
      raise ValueError(f"PDF 渲染失败: {str(exc)}") from exc

  image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
  if image is not None:
    return image

  pil = Image.open(io.BytesIO(image_bytes))
  arr = np.array(pil)
  if arr.ndim == 2:
    return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
  if arr.ndim == 3 and arr.shape[2] == 2:
    return cv2.cvtColor(arr[:, :, 0], cv2.COLOR_GRAY2BGR)
  if arr.ndim == 3 and arr.shape[2] == 4:
    return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
  if arr.ndim == 3 and arr.shape[2] == 3:
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
  raise ValueError(f"不支持的图片通道形状: {arr.shape}")


def _downscale_image_if_needed(image):
  import cv2  # type: ignore

  max_side = int(os.getenv("PADDLE_OCR_MAX_SIDE", "1800"))
  if max_side <= 0:
    return image, 1.0
  h, w = image.shape[:2]
  side = max(h, w)
  if side <= max_side:
    return image, 1.0
  scale = max_side / float(side)
  new_w = max(32, int(w * scale))
  new_h = max(32, int(h * scale))
  resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
  return resized, scale


def _call_paddle_ocr(file_base64: str, mime_type: str) -> dict[str, Any]:
  try:
    # Lazy import: Paddle is optional and heavy.
    import cv2  # type: ignore
    from paddleocr import PaddleOCR  # type: ignore
    _ = PaddleOCR
  except Exception as exc:  # pragma: no cover - env dependent
    raise HTTPException(
      status_code=503,
      detail=f"Paddle OCR 未安装或不可用，请安装 paddleocr/opencv/numpy。{str(exc)}",
    ) from exc

  try:
    image = _decode_input_to_bgr(file_base64, mime_type)
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"图片解码失败: {str(exc)}") from exc

  use_isolated_process = (os.getenv("PADDLE_OCR_ISOLATED", "false").strip().lower() == "true")
  with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
    tmp_path = tmp.name
  try:
    image_for_ocr, scale = _downscale_image_if_needed(image)
    if not cv2.imwrite(tmp_path, image_for_ocr):
      raise HTTPException(status_code=502, detail="Paddle OCR 执行失败: 临时图片写入失败")

    if use_isolated_process:
      result = _run_paddle_predict_in_subprocess(tmp_path)
    else:
      global _PADDLE_OCR_INSTANCE
      if _PADDLE_OCR_INSTANCE is None:
        _PADDLE_OCR_INSTANCE = _create_paddle_instance()
      result = _PADDLE_OCR_INSTANCE.predict(tmp_path)
  except HTTPException:
    raise
  except Exception as exc:  # pragma: no cover - env dependent
    raise HTTPException(status_code=502, detail=f"Paddle OCR 执行失败: {str(exc)}") from exc
  finally:
    try:
      os.remove(tmp_path)
    except OSError:
      pass

  tokens: list[dict[str, Any]] = []
  inv_scale = 1.0 / scale if scale > 0 else 1.0
  # Parse PaddleOCR 2.x list format.
  if isinstance(result, list) and result and isinstance(result[0], list):
    for page in result or []:
      for item in page or []:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
          continue
        quad = item[0]
        text_conf = item[1]
        if not isinstance(text_conf, (list, tuple)) or len(text_conf) < 2:
          continue
        text = str(text_conf[0]).strip()
        conf = _to_num(text_conf[1])
        if not text:
          continue
        xs = [float(pt[0]) for pt in quad]
        ys = [float(pt[1]) for pt in quad]
        x = max(0.0, min(xs)) * inv_scale
        y = max(0.0, min(ys)) * inv_scale
        w = max(0.0, max(xs) - min(xs)) * inv_scale
        h = max(0.0, max(ys) - min(ys)) * inv_scale
        tokens.append(
          {
            "text": text,
            "bbox": {"x": x, "y": y, "w": w, "h": h},
            "confidence": min(1.0, max(0.0, conf)),
          }
        )
  else:
    # Parse PaddleOCR 3.x object/list format.
    pages = result if isinstance(result, list) else [result]
    for page in pages:
      if page is None:
        continue
      rec_texts = []
      rec_scores = []
      rec_polys = []
      if isinstance(page, dict):
        rec_texts = page.get("rec_texts") or page.get("texts") or []
        rec_scores = page.get("rec_scores") or page.get("scores") or []
        rec_polys = page.get("rec_polys") or page.get("polys") or page.get("dt_polys") or []
      else:
        # Try object attrs used by some PaddleOCR wrappers.
        rec_texts = getattr(page, "rec_texts", []) or getattr(page, "texts", [])
        rec_scores = getattr(page, "rec_scores", []) or getattr(page, "scores", [])
        rec_polys = getattr(page, "rec_polys", []) or getattr(page, "polys", []) or getattr(page, "dt_polys", [])

      for idx, text in enumerate(rec_texts):
        t = str(text).strip()
        if not t:
          continue
        conf = _to_num(rec_scores[idx] if idx < len(rec_scores) else 0.9)
        poly = rec_polys[idx] if idx < len(rec_polys) else None
        if poly is None:
          continue
        try:
          xs = [float(pt[0]) for pt in poly]
          ys = [float(pt[1]) for pt in poly]
        except Exception:
          continue
        x = max(0.0, min(xs)) * inv_scale
        y = max(0.0, min(ys)) * inv_scale
        w = max(0.0, max(xs) - min(xs)) * inv_scale
        h = max(0.0, max(ys) - min(ys)) * inv_scale
        tokens.append(
          {
            "text": t,
            "bbox": {"x": x, "y": y, "w": w, "h": h},
            "confidence": min(1.0, max(0.0, conf)),
          }
        )

  return {
    "tokens": tokens,
    "provider": "paddleocr",
    "warnings": [] if tokens else ["paddle_ocr_empty_tokens"],
  }


def _run_paddle_predict_in_subprocess(image_path: str):
  timeout_s = int(os.getenv("PADDLE_OCR_SUBPROCESS_TIMEOUT_S", "120"))
  cmd = [
    sys.executable,
    "-m",
    "app.services.paddle_ocr_worker",
    image_path,
  ]
  try:
    completed = subprocess.run(
      cmd,
      capture_output=True,
      text=True,
      timeout=timeout_s,
      check=False,
    )
  except subprocess.TimeoutExpired as exc:
    raise HTTPException(status_code=502, detail=f"Paddle OCR 执行超时: {timeout_s}s") from exc

  if completed.returncode != 0:
    stderr = (completed.stderr or "").strip()[:400]
    if not stderr:
      stderr = f"exit_code={completed.returncode}"
    raise HTTPException(status_code=502, detail=f"Paddle OCR 子进程失败: {stderr}")

  stdout = (completed.stdout or "").strip()
  if not stdout:
    raise HTTPException(status_code=502, detail="Paddle OCR 子进程未返回结果")

  try:
    payload = json.loads(stdout)
  except json.JSONDecodeError as exc:
    msg = stdout[:200]
    raise HTTPException(status_code=502, detail=f"Paddle OCR 子进程返回非法 JSON: {msg}") from exc

  if not isinstance(payload, dict):
    raise HTTPException(status_code=502, detail="Paddle OCR 子进程返回结构错误")

  if "error" in payload and payload.get("error"):
    raise HTTPException(status_code=502, detail=f"Paddle OCR 子进程错误: {payload['error']}")

  return payload.get("result", [])


def warmup_ocr_engine() -> None:
  engine = (os.getenv("OCR_ENGINE") or "openai").strip().lower()
  if engine != "paddle":
    return
  use_isolated_process = (os.getenv("PADDLE_OCR_ISOLATED", "false").strip().lower() == "true")
  if use_isolated_process:
    # Isolated mode loads Paddle inside a per-request subprocess.
    return
  try:
    from paddleocr import PaddleOCR  # type: ignore
  except Exception as exc:  # pragma: no cover - env dependent
    raise HTTPException(
      status_code=503,
      detail=f"Paddle OCR 未安装或不可用，请安装 paddleocr/opencv/numpy。{str(exc)}",
    ) from exc

  global _PADDLE_OCR_INSTANCE
  if _PADDLE_OCR_INSTANCE is None:
    _ = PaddleOCR
    _PADDLE_OCR_INSTANCE = _create_paddle_instance()


def extract_ocr_tokens(file_base64: str, mime_type: str) -> dict[str, Any]:
  engine = (os.getenv("OCR_ENGINE") or "claude").strip().lower()
  if engine == "paddle":
    return _call_paddle_ocr(file_base64, mime_type)

  if engine in ("claude", "anthropic"):
    return _call_claude_ocr(file_base64, mime_type)

  if engine in ("openai", "openai_compatible", "openai-compatible"):
    return _call_openai_compatible_ocr(file_base64, mime_type)

  raise HTTPException(status_code=503, detail=f"不支持的 OCR_ENGINE: {engine}")


def extract_ocr_tokens_openai_only(file_base64: str, mime_type: str) -> dict[str, Any]:
  # Backward-compatible alias; now routes to configured OCR engine.
  return extract_ocr_tokens(file_base64, mime_type)
