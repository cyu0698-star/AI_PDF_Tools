from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    fileBase64: str
    mimeType: str
    templateType: str


class ProcessResponse(BaseModel):
    headers: list = Field(default_factory=list)
    rows: list = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)
    rawText: str = ""
