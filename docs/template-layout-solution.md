# 模板版式回填方案（图片/扫描件/电子PDF）

## 1. 目标

实现以下能力：

1. 用户上传模板图片、扫描 PDF 或电子版 PDF。
2. 系统解析模板版式（字段语义 + 坐标布局 + 表格区域）。
3. 用户上传真实单据后，自动抽取数据并映射到模板布局。
4. 导出结果尽量保持模板排版一致（Excel 优先，PDF 可选）。

---

## 2. 总体架构

采用“双分支 + 统一版式模型”的策略：

1. `electronic_pdf_pipeline`（高保真）
2. `ocr_pipeline`（通用兜底，支持图片/扫描 PDF）

两条分支都输出同一种 `template_layout` JSON，后续抽取和导出统一处理。

---

## 3. 分支方案

### 3.1 electronic_pdf_pipeline（电子版 PDF）

适用：PDF 含文本层（非纯扫描）。

处理流程：

1. 使用 `PyMuPDF/pdfplumber` 提取文本对象：
   - `text`
   - `bbox(x,y,w,h,page)`
   - `fontName`
   - `fontSize`
2. 视觉/LLM 仅做语义分类（字段、表头、明细区、汇总区、噪声区）。
3. 输出高保真 `template_layout`（可保留真实字体大小）。

优势：坐标与字体信息更准确，排版回填最稳定。

### 3.2 ocr_pipeline（图片/扫描件）

适用：JPG/PNG/扫描 PDF。

处理流程：

1. OCR（推荐 `PaddleOCR`）提取：
   - `text`
   - `bbox`
   - `confidence`
2. 视觉/LLM 做语义理解与区域划分。
3. 对齐引擎将语义字段与 OCR token 关联，生成锚点。
4. 字体大小用 bbox 高度估算（非真实值）。

限制：字体/字号无法 100% 真实还原，只能近似。

---

## 4. 核心数据模型（template_layout）

建议存储结构（示例）：

```json
{
  "templateId": "tpl_xxx",
  "sourceType": "electronic_pdf|scanned_pdf|image",
  "page": { "width": 2480, "height": 3508, "unit": "px" },
  "fields": [
    {
      "key": "invoiceDate",
      "label": "开票日期",
      "semanticType": "date",
      "labelBox": {"x": 120, "y": 160, "w": 120, "h": 36},
      "valueBox": {"x": 260, "y": 160, "w": 220, "h": 36},
      "font": {"family": "SimSun", "size": 12, "weight": 400, "estimated": false},
      "confidence": 0.94
    }
  ],
  "table": {
    "headerBox": {"x": 90, "y": 420, "w": 2200, "h": 48},
    "dataRegionBox": {"x": 90, "y": 468, "w": 2200, "h": 1600},
    "columns": [
      {"key": "itemName", "label": "货物名称", "box": {"x": 120, "y": 420, "w": 420, "h": 48}},
      {"key": "qty", "label": "数量", "box": {"x": 1180, "y": 420, "w": 180, "h": 48}}
    ],
    "repeatDirection": "down",
    "rowHeight": 40
  },
  "summary": [
    {
      "key": "totalAmount",
      "label": "价税合计",
      "valueBox": {"x": 1760, "y": 2160, "w": 520, "h": 48}
    }
  ],
  "meta": {
    "createdAt": "2026-02-28T00:00:00Z",
    "version": 1
  }
}
```

---

## 5. API 设计

### 5.1 新增：`POST /api/template/analyze`

用途：模板解析（创建模板时调用）

请求：

```json
{
  "fileBase64": "...",
  "mimeType": "application/pdf|image/png|image/jpeg",
  "templateName": "发票模板A"
}
```

响应：

```json
{
  "templateLayout": { "...": "..." },
  "warnings": ["font estimated from OCR"],
  "confidence": 0.91
}
```

### 5.2 升级：`POST /api/template/extract`

用途：真实单据提取并映射到模板布局

请求：

```json
{
  "fileBase64": "...",
  "mimeType": "application/pdf|image/png|image/jpeg",
  "templateId": "tpl_xxx"
}
```

### 5.3 OCR Provider HTTP 协议（已落地）

当前前端支持 `OCR_PROVIDER=http`，请求 OCR HTTP 服务：

请求（POST `OCR_HTTP_URL`）：

```json
{
  "fileBase64": "...",
  "mimeType": "image/png",
  "sourceType": "image|scanned_pdf",
  "mockMode": "empty|basic|dense"
}
```

响应（最小协议）：

```json
{
  "tokens": [
    {
      "text": "开票日期",
      "bbox": { "x": 120, "y": 160, "w": 140, "h": 32 }
    }
  ],
  "provider": "your-ocr-provider",
  "warnings": []
}
```

容错策略：

1. HTTP provider 非 200、超时或失败时自动降级 `mock`。
2. `tokens` 为空时不会中断主流程，但会进入低置信度回传路径。
3. 前端也可直接传 `ocrTokens`，优先级高于 HTTP provider。

当前仓库已提供 backend mock OCR 接口：`POST /api/ocr`。

响应：

```json
{
  "mappedData": {
    "companyInfo": {},
    "tableRows": [],
    "summary": {}
  },
  "lowConfidenceFields": [
    {"key": "invoiceDate", "confidence": 0.56}
  ]
}
```

---

## 6. 导出策略（布局回填）

### 6.1 Excel 导出

1. 不再 `json_to_sheet` 直接重建整表。
2. 基于 `template_layout` 写固定区域单元格。
3. 明细区按 `repeatDirection + rowHeight` 填充可重复行。
4. 需要时处理：
   - 合并单元格
   - 列宽/行高
   - 基础字体样式（电子 PDF 优先）

### 6.2 PDF 导出（可选）

如需更接近视觉一致，可增加 PDF 生成路径（按坐标绘制文本）。

---

## 7. 现有项目改造点

1. 新增路由：`frontend/src/app/api/template/analyze/route.ts`
2. 升级路由：`frontend/src/app/api/template/extract/route.ts`
3. 新增服务层：
   - `frontend/src/server/layout/parser.ts`
   - `frontend/src/server/layout/aligner.ts`
4. 升级模板存储：
   - `frontend/src/features/templates/storage/templateStorage.ts`
   - 增加 `templateLayout` 存储
5. 升级导出：
   - `frontend/src/shared/utils/exportUtils.ts`
6. 前端 UI：
   - `TemplateCreatorModal` 增加模板框预览与人工修正

---

## 8. 实施计划

### Phase 1（快速稳定，1-2 天）

1. 修复当前类型分支问题：`template/extract` 明确仅支持图片/PDF，Excel 给清晰错误。
2. 增加日志：记录入口 API、mimeType、所走分支。

### Phase 2（MVP，4-6 天）

1. 完成 `/api/template/analyze`。
2. 先落地 `ocr_pipeline`（图片/扫描）+ 语义对齐。
3. 存储 `template_layout`，并支持前端预览修正。

### Phase 3（高保真，4-6 天）

1. 增加 `electronic_pdf_pipeline`（PyMuPDF）。
2. 打通统一抽取与映射。

### Phase 4（导出升级，3-5 天）

1. 布局回填 Excel 导出。
2. 低置信度字段人工修正闭环。

---

## 9. 风险与边界

1. 图片/扫描件无法保证真实字体还原，只能估算。
2. 电子 PDF 可获得更高保真，但不同 PDF 生产器格式差异大。
3. 表格跨页、盖章遮挡、旋转拍摄会降低稳定性。

---

## 10. 验收指标（建议）

1. 字段映射准确率 >= 90%
2. 表头识别准确率 >= 95%
3. 低置信度字段占比 <= 15%
4. 电子 PDF 场景导出布局偏差（人工评估）显著优于 OCR 场景

---

## 11. 当前结论

1. 方案可行，且包含电子版 PDF 分支。
2. 推荐优先实现统一 `template_layout`，避免后续重复改造。
3. 先 MVP（可用）再高保真（电子 PDF）是性价比最高路线。
