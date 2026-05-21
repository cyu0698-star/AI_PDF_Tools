# Template-to-Data Pipeline Rebuild Blueprint

## 1. Goal and Non-Negotiables

### 1.1 Business goal
- Upload a template once (image/PDF), preserve layout semantics + coordinates.
- Upload new real document data, map values into template reliably.
- Export Excel with layout position as close as possible to template.

### 1.2 Non-negotiables
- No mock data in production path.
- Coordinate system must be explicit and traceable.
- OCR/provider failure must fail fast with clear reason (no silent empty template).
- Export path must be quality-gated (bad alignment => degrade/abort).

## 2. External Benchmarks and Tool Signals (Web Research)

This plan is aligned with official docs and widely used implementations:

- PaddleOCR PP-StructureV3 supports structured output (json/layout/table/markdown) and PDF/image pipelines.
  - https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PP-StructureV3.html
- Google Document AI exposes `Document.Page.Token/Layout/BoundingPoly/Table/StyleInfo`.
  - https://cloud.google.com/document-ai/docs/reference/rest/v1/Document
- AWS Textract geometry model is explicit about normalized bbox/polygon and pixel conversion.
  - https://docs.aws.amazon.com/textract/latest/dg/API_BoundingBox.html
  - https://docs.aws.amazon.com/textract/latest/dg/API_Geometry.html
- OpenCV provides robust affine estimation with RANSAC (`estimateAffinePartial2D`).
  - https://docs.opencv.org/master/d9/d0c/group__calib3d.html
- XlsxWriter supports pixel-oriented row/column sizing and merge operations required for layout export.
  - https://xlsxwriter.readthedocs.io/contents.html
  - https://xlsxwriter.readthedocs.io/worksheet.html
- Table Transformer and Donut are valid advanced alternatives but require more training/integration cost.
  - https://github.com/microsoft/table-transformer
  - https://github.com/clovaai/donut

Inference from sources:
- For your requirement ("position correctness first"), OCR+geometry+alignment is more controllable than OCR-free end-to-end models.
- VLM should remain semantic helper, not geometry source of truth.

## 3. Target Architecture

## 3.1 Two input branches, one unified IR

### Branch A: electronic PDF
- Source: embedded text objects + vector/page metadata.
- Priority: highest geometry fidelity.

### Branch B: image/scanned PDF
- Source: OCR engine output (tokens, confidence, polygons/bboxes).
- Priority: robust fallback coverage.

### Unified middle layer (must-have)
- Normalize both branches into one contract: `DocumentIR`.

```json
{
  "docId": "doc_xxx",
  "sourceType": "electronic_pdf|scanned_pdf|image",
  "pages": [
    {
      "page": 1,
      "width": 2226,
      "height": 1308,
      "unit": "px"
    }
  ],
  "tokens": [
    {
      "id": "t_1",
      "page": 1,
      "text": "送货单号",
      "bbox": {"x": 1564, "y": 291, "w": 120, "h": 40},
      "polygon": [1564,291,1684,291,1684,331,1564,331],
      "confidence": 0.99,
      "style": {"fontSize": 14, "fontWeight": 500, "fontFamily": null},
      "source": "pdf_text|ocr"
    }
  ],
  "tables": [],
  "meta": {"ocrProvider": "paddle|cloud", "warnings": []}
}
```

## 3.2 Template lifecycle contracts

### TemplateIR (saved after template analyze)

```json
{
  "templateId": "tpl_xxx",
  "pageRef": {"width": 2226, "height": 1308, "unit": "px"},
  "anchors": [
    {"id": "a_1", "text": "送货单", "bbox": {"x": 917, "y": 214, "w": 268, "h": 73}}
  ],
  "fields": [
    {
      "key": "deliveryNo",
      "label": "送货单号",
      "labelBox": {"x": 1540, "y": 286, "w": 120, "h": 45},
      "valueBox": {"x": 1660, "y": 286, "w": 380, "h": 45},
      "type": "text"
    }
  ],
  "table": {
    "headerTokens": ["序号", "订单号", "产品名称", "单位", "数量", "单价", "总额", "备注"],
    "headerBox": {"x": 8, "y": 479, "w": 2035, "h": 64},
    "dataRegionBox": {"x": 8, "y": 544, "w": 2035, "h": 460},
    "columns": [
      {"key": "productName", "label": "产品名称", "box": {"x": 560, "y": 479, "w": 380, "h": 64}}
    ]
  },
  "quality": {"isQualified": true, "anchorCoverage": 1.0, "confidence": 0.92}
}
```

### FilledIR (result after applying real document to template)

```json
{
  "templateId": "tpl_xxx",
  "docId": "doc_real_xxx",
  "transform": {
    "kind": "affine_partial_2d",
    "matrix": [[1.002, 0.003, -6.1], [-0.002, 1.001, 4.8]],
    "inlierRatio": 0.89,
    "reprojectionErrorPx": 6.7
  },
  "fields": {
    "deliveryNo": {"value": "LF2025030303", "confidence": 0.96}
  },
  "tableRows": [
    {"productName": "客制_拉松轮刹车轮...", "qty": "1", "unitPrice": "", "amount": ""}
  ],
  "quality": {"exportReady": true, "failures": []}
}
```

## 4. Module Split (Mapped to Current Repo)

## 4.1 Frontend API routes
- Keep:
  - `frontend/src/app/api/template/analyze/route.ts`
  - `frontend/src/app/api/template/extract/route.ts`
  - `frontend/src/app/api/process/route.ts`
- Refactor responsibilities:
  - `analyze`: produce and validate `TemplateIR`.
  - `extract`: produce `FilledIR` only.
  - `process`: only for built-in non-template extraction flows.

## 4.2 Layout/IR core
- Existing foundation:
  - `frontend/src/server/layout/parser.mjs`
  - `frontend/src/server/layout/aligner.mjs`
  - `frontend/src/server/layout/quality.mjs`
  - `frontend/src/server/layout/pipelines/*`
- Add/normalize:
  - `ir.mjs`: `DocumentIR`, `TemplateIR`, `FilledIR` schemas + runtime guards.
  - `transform.mjs`: anchor matching, affine estimation, reprojection metrics.
  - `mapper.mjs`: box-to-token aggregation for fields and tables.
  - `gate.mjs`: export gate rules.

## 4.3 OCR service layer
- Backend:
  - `backend/app/services/ocr_service.py` remains OCR adapter entry.
  - Add explicit response schema parity with frontend IR requirements.
- Rule:
  - OCR output must include page size + token bbox in pixel units.
  - On provider fail, return hard error with machine-readable code.

## 4.4 Export layer
- Existing:
  - `frontend/src/shared/utils/layoutExport.mjs`
  - `frontend/src/shared/utils/exportUtils.ts`
- Rebuild into two-stage:
  - `layout_grid.mjs`: pixel-to-cell mapping and merge plan generation.
  - `excel_writer.mjs`: apply values/styles/merge/borders and emit workbook.

## 5. Coordinate Discipline (Critical)

## 5.1 Canonical coordinate system
- Canonical internal unit: `px`, origin top-left, per-page local coordinates.
- Any normalized coordinates from providers must be converted on ingestion.

## 5.2 Transform rule
- Never write template boxes directly onto new document.
- Always compute `T` from anchor pairs:
  - template anchors -> document anchors
  - use RANSAC to filter outliers
- Apply `T` to all template boxes before extraction.

## 5.3 Quality thresholds (initial)
- `inlierRatio >= 0.6`
- `reprojectionErrorPx <= 12`
- `fieldHitRate >= 0.75`
- `tableColumnCoverage >= 0.7`
- If failed: degrade to semantic export or block with explicit diagnostics.

## 6. Detailed Runtime Data Flow

1. User uploads template -> `/api/template/analyze`
2. Pipeline builds `DocumentIR` from PDF/OCR branch
3. Semantic classifier labels fixed/variable/header (assistive only)
4. Build and persist `TemplateIR` (`anchors/fields/table/pageRef/quality`)
5. User uploads real doc + selects template -> `/api/template/extract`
6. Build real-doc `DocumentIR`
7. Anchor match + compute transform `T`
8. Transform template slots to real-doc coordinates
9. Extract field values and table rows from transformed regions
10. Produce `FilledIR` + quality diagnostics
11. Export service converts `TemplateIR + FilledIR` -> positioned Excel

## 7. Role of AI Vision Model (Kimi/OpenAI)

- Keep for:
  - token semantic disambiguation
  - fixed-vs-variable hints
  - anomaly explanation text
- Do not use for:
  - final bbox coordinates
  - geometry alignment source
  - deterministic table column boundaries

This avoids non-deterministic geometry drift.

## 8. Phase-by-Phase Delivery Plan

## Phase 1: IR hardening + schema guards
- Deliverables:
  - `DocumentIR/TemplateIR/FilledIR` schema + validators
  - Normalize all route outputs to schema
- Tests:
  - malformed payload, missing arrays, unknown fields, empty tokens

## Phase 2: deterministic alignment core
- Deliverables:
  - anchor matcher + affine estimator + quality metrics
  - transform application over all boxes
- Tests:
  - synthetic perturbation (scale/translate/rotation), outlier anchors

## Phase 3: field/table extractor
- Deliverables:
  - slot-region token aggregation
  - row clustering + column assignment
- Tests:
  - multiline fields, merged-like cells, sparse rows, noisy OCR

## Phase 4: Excel layout writer
- Deliverables:
  - pixel grid mapping, merge plan, style replay
  - confidence-aware fallback (blank vs inferred)
- Tests:
  - golden workbook snapshots, cell coordinate assertions

## Phase 5: observability + gatekeeping
- Deliverables:
  - diagnostics payload (`codes + metrics + failedKeys`)
  - UI surfacing of quality and fallback mode
- Tests:
  - forced provider timeout, empty OCR, low-anchor scenarios

## 9. Tooling Decision Matrix (for this project)

- Primary OCR: Paddle (local, cost-stable, controllable).
- Optional cloud OCR profile: Document AI / Textract adapter.
- Geometry engine: OpenCV.
- Export engine: XlsxWriter-oriented layout writer logic.
- AI semantic helper: existing Kimi/OpenAI route.

Reasoning:
- This combination minimizes random geometry drift and maximizes reproducibility for Excel layout restoration.

## 10. Immediate Next Step in This Repo

1. Freeze current contracts and add `IR` schema validators.
2. Move alignment logic to a dedicated transform module with explicit metrics.
3. Gate `/api/template/extract` on transform quality before export.
4. Replace any direct token-role heuristics in export with transformed slot extraction output.

