import json
import os
import sys


def _create_paddle():
  os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
  from paddleocr import PaddleOCR  # type: ignore
  return PaddleOCR(
    lang="ch",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    text_detection_model_name="PP-OCRv5_mobile_det",
    text_recognition_model_name="PP-OCRv5_mobile_rec",
  )


def main() -> int:
  if len(sys.argv) != 2:
    print(json.dumps({"error": "missing_image_path"}, ensure_ascii=False))
    return 2
  image_path = sys.argv[1]
  try:
    ocr = _create_paddle()
    result = ocr.predict(image_path)
    print(json.dumps({"result": result}, ensure_ascii=False, default=str))
    return 0
  except Exception as exc:
    print(json.dumps({"error": str(exc)}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
  raise SystemExit(main())
