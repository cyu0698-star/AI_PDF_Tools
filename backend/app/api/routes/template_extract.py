"""POST /api/template-extract — structured-data extraction for custom templates.

Called by the frontend's /api/template/extract route. The frontend was
previously calling Anthropic directly from Node.js fetch, which Anthropic
blocks (403 forbidden). Routing through here uses httpx in Python which
Anthropic accepts.
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.claude_service import extract_with_ai, is_ai_proxy_configured


router = APIRouter()


class TemplateField(BaseModel):
    key: str
    label: str


class CompanyInfo(BaseModel):
    fields: list[TemplateField] = []


class TemplateStructure(BaseModel):
    companyInfo: CompanyInfo = CompanyInfo()
    tableHeaders: list[str] = []
    summaryFields: list[str] = []


class TemplateExtractRequest(BaseModel):
    fileBase64: str
    mimeType: str
    templateStructure: TemplateStructure


def _build_strict_prompt(structure: TemplateStructure) -> str:
    company_block = (
        "\n".join(f"  - key={f.key}, 含义={f.label}" for f in structure.companyInfo.fields)
        if structure.companyInfo.fields
        else "  （无）"
    )
    table_block = (
        "\n".join(f"  {i + 1}. {h}" for i, h in enumerate(structure.tableHeaders))
        if structure.tableHeaders
        else "  （无）"
    )
    summary_block = (
        "\n".join(f"  - {f}" for f in structure.summaryFields)
        if structure.summaryFields
        else "  （无）"
    )

    return f"""你是结构化数据提取引擎。请从上传的原始单据（图片或PDF）中提取数据，并严格按下方"模板字段定义"返回 JSON。

# ★ 最高优先级铁律（违反任意一条都是严重错误）★

1. **绝对禁止捏造任何数据**。如果你看不到/不确定，就返回空字符串 `""`（绝不要 `null`，绝不要占位文字，绝不要"看起来合理"的值）。
   - ❌ 错：客户地址 = "Moltkestr. 96"（凭空捏造一个地址）
   - ❌ 错：手机 = "13380243510"（凭空捏造一个手机号）
   - ❌ 错：物料代码 = "01" / "02" / "03"（按行号编一个代码）
   - ✓ 对：上述这些字段如果 PDF 里没有，**全部返回 ""**

2. **绝对禁止使用 placeholder/占位符文字**。
   - ❌ 错：送货单号 = "（送货单号）" 或 "(送货单号)" 或 "（待填）" 或 "TBD"
   - ❌ 错：订单号 = "（订单号placeholder）" 或 "<order_no>" 或 "xxx"
   - ✓ 对：上述这些字段如果 PDF 里没有，**全部返回 ""**

3. **绝对禁止跨列移动数据**。某列的值必须在 PDF 视觉对应的列里能找到。
   - 数量、单价、金额是数字 → 它们必须能从 PDF 的对应数字列读出
   - 单位（公斤/件/PC）→ 必须能从 PDF 的"单位"列读出；不要把数字 "1" 写进单位
   - 备注 → 只装 PDF 的备注列内容；不要把规格也塞进来

# 模板字段定义

## 公司信息字段（key → 中文含义）
{company_block}

## 明细表列（按顺序排列；这是收单方的模板列，不一定能在原单据里找到完全对应列）
{table_block}

## 汇总字段
{summary_block}

# 详细规则

A. **公司信息字段（companyInfo）**：通常是**单据归属方/我方公司**的信息。如果 PDF 里有清晰的"我方"抬头（如顶部居中的公司名+地址+电话），从那里取；如果 PDF 是一份"对方发来的单据"且没有我方信息，所有字段返回 ""。**禁止把客户/供应商的信息当成 companyInfo 填**。

B. **明细表列**：
   - "序号" 只能填阿拉伯数字（1, 2, 3...），按行顺序
   - "订单号" 只能填明确的订单/合同编号字符串；PDF 没有就 ""
   - "物料代码" / "物料编码" 只能填物料编号/料号字符串；PDF 没有就 ""（不要按行号编 "01" "02" "03"）
   - "产品名称" / "品名" 只能填产品的名称或描述；PDF 没有就 ""
   - "规格" / "规格型号" 只能填规格描述（如 0.8*57, M2.5）
   - "单位" 只能填计量单位字符串（PC、公斤、个、件等）；PDF 单位列若为空则填 ""，**绝对不要填数字**
   - "数量"、"单价"、"金额" / "总额" 只能是数字字符串；PDF 留空则填 ""
   - "备注" 只填 PDF 备注列里的文字；PDF 备注列为空就 ""

C. **逐列严格对位**：每行对象只能包含"明细表列"里列出的字段名作为 key。

D. **汇总字段（summary）= 收货方/客户/对方信息**：
   - "客户名称""客户地址""客户电话"只填 PDF 里明确属于"收货方/客户/送货至/Bill To"的内容
   - **绝对不要**：把我方供应商的地址电话塞进客户字段
   - **绝对不要**：凭印象写一个地址或电话（如 "Moltkestr. 96"、"01784..." 这种）

E. **行数与原 PDF 一致**：原 PDF 有几行数据就返回几行；不要多不要少。

F. 只返回一个 JSON 对象，不要加任何前后文、不要 markdown 代码块。

# 返回 JSON 格式（值都用字符串；找不到的全部 ""）
{{
  "companyInfo": {{ "<key>": "" }},
  "tableRows": [
    {{ "<明细列名1>": "", "<明细列名2>": "" }}
  ],
  "summary": {{ "<汇总字段名>": "" }}
}}

# 最终检查清单（提交前自我核对）
☐ companyInfo 里没有捏造的公司名/地址/电话
☐ summary 里没有捏造的客户信息（地址/电话）
☐ 没有任何字段值是括号占位文字（如 "(xxx)" "（xxx）" "placeholder" "TBD" "xxx" "/"）
☐ 单位列是"公斤""PC""个"这种字符串，**不是数字**
☐ 物料代码列要么是 PDF 里真实的编号，要么是 ""，**不是按行号编的 "01" "02"**
☐ 备注列要么是 PDF 里的备注文字，要么是 ""

现在请认真提取并返回 JSON。如果不确定就空。"""


@router.post("/api/template-extract")
async def template_extract(payload: TemplateExtractRequest) -> dict[str, Any]:
    if not is_ai_proxy_configured():
        raise HTTPException(status_code=500, detail="AI_API_KEY 未配置")

    prompt = _build_strict_prompt(payload.templateStructure)

    try:
        raw = extract_with_ai(payload.fileBase64, payload.mimeType, prompt)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="AI 返回的数据格式无法解析") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Normalize: ensure shape is { companyInfo, tableRows, summary }
    return {
        "companyInfo": raw.get("companyInfo", {}) or {},
        "tableRows": raw.get("tableRows", raw.get("rows", [])) or [],
        "summary": raw.get("summary", {}) or {},
    }
