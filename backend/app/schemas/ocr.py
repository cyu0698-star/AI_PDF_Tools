from pydantic import BaseModel, Field


class OcrRequest(BaseModel):
    fileBase64: str
    mimeType: str
    sourceType: str = "image"


class OcrToken(BaseModel):
    text: str
    bbox: dict = Field(default_factory=dict)
    confidence: float = 0.9


class OcrResponse(BaseModel):
    tokens: list[OcrToken] = Field(default_factory=list)
    provider: str = "mock"
    warnings: list[str] = Field(default_factory=list)
