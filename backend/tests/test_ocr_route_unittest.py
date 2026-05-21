import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class TestOcrRoute(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_ocr_without_gemini_returns_503(self):
        app.state.client = None
        response = self.client.post(
            "/api/ocr",
            json={
                "fileBase64": "ZmFrZQ==",
                "mimeType": "image/png",
                "sourceType": "image",
            },
        )
        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertIn("真实 OCR 未配置", payload["detail"])

    def test_ocr_returns_real_provider_payload(self):
        app.state.client = object()
        with patch(
            "app.api.routes.ocr.extract_ocr_tokens_with_gemini",
            return_value={
                "tokens": [
                    {
                        "text": "公司名称",
                        "bbox": {"x": 120, "y": 160, "w": 140, "h": 32},
                        "confidence": 0.95,
                    }
                ],
                "provider": "gemini-vision",
                "warnings": [],
            },
        ):
            response = self.client.post(
                "/api/ocr",
                json={
                    "fileBase64": "ZmFrZQ==",
                    "mimeType": "image/png",
                    "sourceType": "image",
                },
            )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["provider"], "gemini-vision")
        self.assertEqual(len(payload["tokens"]), 1)


if __name__ == "__main__":
    unittest.main()
