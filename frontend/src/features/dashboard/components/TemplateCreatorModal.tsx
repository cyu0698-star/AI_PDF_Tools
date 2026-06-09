"use client";

import { useState, useCallback } from "react";
import {
  CustomTemplate,
  LayoutTokenRole,
  TemplateModel,
  TemplateLayout,
  TemplateLayoutToken,
  TemplateField,
  TemplateType,
  TemplateRecognitionResult,
  MAX_FILE_SIZE,
} from "@/features/documents/types";
import { saveTemplate, generateTemplateId } from "@/features/templates/storage/templateStorage";
import { buildNonJsonApiError, parseJsonSafely } from "@/lib/http";
import { useTr } from "@/lib/i18nClient";

interface TemplateCreatorModalProps {
  isOpen: boolean;
  category: TemplateType;
  categoryName: string;
  onClose: () => void;
  onSaved: (template: CustomTemplate) => void;
}

type ModalStep = "upload" | "recognizing" | "preview";
type LayoutQuality = {
  isQualified: boolean;
  ocrTokenCount: number;
  totalFields: number;
  anchoredFields: number;
  anchorRate: number;
  confidence: number;
  failures: string[];
};
type LayoutDiagnostics = {
  sourceType: string;
  pipeline: string;
  ocrProvider: string;
  tokenSource: string;
  warnings: string[];
  failures: string[];
  primaryIssue: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
}

function normalizeTemplateFields(value: unknown): TemplateField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const obj = asObject(item);
      const key = typeof obj.key === "string" && obj.key.trim() ? obj.key.trim() : `field_${index + 1}`;
      const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : key;
      const typeRaw = typeof obj.type === "string" ? obj.type : "text";
      const type: "text" | "number" | "date" =
        typeRaw === "number" || typeRaw === "date" || typeRaw === "text" ? typeRaw : "text";
      const required = Boolean(obj.required);
      return { key, label, type, required };
    })
    .filter((field) => field.label.length > 0);
}

function normalizeRecognitionResult(value: unknown): TemplateRecognitionResult {
  const root = asObject(value);
  const companyInfo = asObject(root.companyInfo);

  return {
    companyInfo: {
      fields: normalizeTemplateFields(companyInfo.fields),
    },
    tableHeaders: normalizeStringArray(root.tableHeaders),
    tableFieldTypes: normalizeStringArray(root.tableFieldTypes),
    summaryFields: normalizeStringArray(root.summaryFields),
  };
}

function toSemanticType(value: string | undefined): "text" | "number" | "date" {
  return value === "number" || value === "date" || value === "text"
    ? value
    : "text";
}

function collectLayoutBoxes(layout: TemplateLayout): Array<{ x: number; y: number; w: number; h: number }> {
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const field of layout.fields) {
    if (field.labelBox) boxes.push(field.labelBox);
    if (field.valueBox) boxes.push(field.valueBox);
  }
  for (const col of layout.table.columns) {
    if (col.box) boxes.push(col.box);
  }
  if (layout.table.headerBox) boxes.push(layout.table.headerBox);
  if (layout.table.dataRegionBox) boxes.push(layout.table.dataRegionBox);
  for (const item of layout.summary) {
    if (item.valueBox) boxes.push(item.valueBox);
  }
  return boxes;
}

function tokenRoleClass(role: LayoutTokenRole): string {
  switch (role) {
    case "fixed_text":
      return "border-sky-400/80 bg-sky-400/10";
    case "fillable_value":
      return "border-emerald-500/80 bg-emerald-500/10";
    case "table_header":
      return "border-amber-500/90 bg-amber-500/10";
    case "table_cell":
      return "border-violet-500/80 bg-violet-500/10";
    default:
      return "border-slate-400/70 bg-slate-400/10";
  }
}

function tokenTextClass(role: LayoutTokenRole, text: string): string {
  if (!text) return "text-transparent";
  switch (role) {
    case "fillable_value":
      return "text-slate-500/80";
    case "table_cell":
      return "text-slate-700/85";
    default:
      return "text-slate-800";
  }
}

function likelyTemplateLabel(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  const keyword =
    /(公司|名称|地址|电话|传真|手机|日期|单号|编号|联系人|税号|开户|银行|账号|备注|合计|金额|客户|供方|购方|收货|发货|序号|订单号|产品名称|品名|规格|单位|数量|单价|总额)/;
  if (t.endsWith(":") || t.endsWith("：")) return true;
  return keyword.test(t) && t.length <= 24;
}

type SyntheticToken = {
  id: string;
  text: string;
  role: LayoutTokenRole;
  left: number;
  top: number;
  width: number;
  height: number;
};

type TablePreview = {
  headers: string[];
  rows: string[][];
};

function buildTablePreview(
  layout: TemplateLayout,
  recognized: TemplateRecognitionResult | null
): TablePreview | null {
  const tokens = Array.isArray(layout.tokens) ? layout.tokens : [];
  const headerTokens = tokens
    .filter((t) => t.role === "table_header" && t.text.trim().length > 0)
    .sort((a, b) => a.bbox.x - b.bbox.x);

  let columns: Array<{ label: string; x: number }> = headerTokens.map((t) => ({
    label: t.text.trim(),
    x: t.bbox.x + t.bbox.w / 2,
  }));

  if (columns.length === 0 && Array.isArray(layout.table?.columns) && layout.table.columns.length > 0) {
    columns = layout.table.columns.map((c, i) => ({
      label: (c.label || "").trim() || `列${i + 1}`,
      x: c.box ? c.box.x + c.box.w / 2 : i * 100,
    }));
  }

  if (columns.length === 0 && recognized?.tableHeaders?.length) {
    columns = recognized.tableHeaders.map((h, i) => ({
      label: h.trim() || `列${i + 1}`,
      x: i * 100,
    }));
  }

  if (columns.length === 0) return null;

  const cellTokens = tokens
    .filter((t) => t.role === "table_cell" && t.text.trim().length > 0)
    .sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 8) return yDiff;
      return a.bbox.x - b.bbox.x;
    });

  const avgCellH =
    cellTokens.length > 0
      ? cellTokens.reduce((acc, t) => acc + t.bbox.h, 0) / cellTokens.length
      : 20;
  const rowTolerance = Math.max(10, avgCellH * 0.8);

  const rowGroups: Array<{ y: number; tokens: TemplateLayoutToken[] }> = [];
  for (const token of cellTokens) {
    const y = token.bbox.y + token.bbox.h / 2;
    const matched = rowGroups.find((row) => Math.abs(row.y - y) <= rowTolerance);
    if (matched) {
      matched.tokens.push(token);
      matched.y = (matched.y + y) / 2;
    } else {
      rowGroups.push({ y, tokens: [token] });
    }
  }

  rowGroups.sort((a, b) => a.y - b.y);

  const rows = rowGroups.slice(0, 6).map((row) => {
    const cols = new Array(columns.length).fill("");
    for (const token of row.tokens) {
      const cx = token.bbox.x + token.bbox.w / 2;
      let bestIdx = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < columns.length; i += 1) {
        const d = Math.abs(columns[i].x - cx);
        if (d < bestDistance) {
          bestDistance = d;
          bestIdx = i;
        }
      }
      cols[bestIdx] = cols[bestIdx] ? `${cols[bestIdx]} ${token.text}` : token.text;
    }
    return cols;
  });

  if (rows.length === 0) {
    rows.push(
      new Array(columns.length).fill(""),
      new Array(columns.length).fill(""),
      new Array(columns.length).fill("")
    );
  }

  return {
    headers: columns.map((c) => c.label),
    rows,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * Math.max(0, Math.min(1, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function buildSyntheticTemplate(layout: TemplateLayout): {
  tokens: SyntheticToken[];
  aspectRatio: number;
} {
  const tokens: TemplateLayoutToken[] = Array.isArray(layout.tokens)
    ? layout.tokens.filter(
        (t) =>
          t &&
          t.bbox &&
          typeof t.bbox.x === "number" &&
          typeof t.bbox.y === "number" &&
          typeof t.bbox.w === "number" &&
          typeof t.bbox.h === "number" &&
          t.bbox.w > 0 &&
          t.bbox.h > 0
      )
    : [];

  if (tokens.length === 0) {
    return { tokens: [], aspectRatio: 1.35 };
  }

  // Use robust percentile bounds to avoid a few outlier tokens collapsing all boxes into top-left.
  const startsX = tokens.map((t) => t.bbox.x);
  const startsY = tokens.map((t) => t.bbox.y);
  const endsX = tokens.map((t) => t.bbox.x + t.bbox.w);
  const endsY = tokens.map((t) => t.bbox.y + t.bbox.h);

  const hardMinX = Math.min(...startsX);
  const hardMinY = Math.min(...startsY);
  const hardMaxX = Math.max(...endsX);
  const hardMaxY = Math.max(...endsY);

  const pMinX = percentile(startsX, 0.03);
  const pMinY = percentile(startsY, 0.03);
  const pMaxX = percentile(endsX, 0.97);
  const pMaxY = percentile(endsY, 0.97);

  const minX = pMaxX - pMinX > 10 ? pMinX : hardMinX;
  const minY = pMaxY - pMinY > 10 ? pMinY : hardMinY;
  const maxX = pMaxX - pMinX > 10 ? pMaxX : hardMaxX;
  const maxY = pMaxY - pMinY > 10 ? pMaxY : hardMaxY;

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const mapped: SyntheticToken[] = tokens.map((t) => {
    const left = ((t.bbox.x - minX) / spanX) * 100;
    const top = ((t.bbox.y - minY) / spanY) * 100;
    const width = (t.bbox.w / spanX) * 100;
    const height = (t.bbox.h / spanY) * 100;
    return {
      id: t.id,
      text: t.text,
      role: t.role,
      left: clamp(left, 0, 99.5),
      top: clamp(top, 0, 99.5),
      width: clamp(width, 0.6, 100),
      height: clamp(height, 0.8, 100),
    };
  });

  // Merge inferred fillable boxes (from field valueBox) to show editable areas even when OCR has no value token.
  if (Array.isArray(layout.fields)) {
    layout.fields.forEach((field, idx) => {
      if (!field?.valueBox) return;
      const v = field.valueBox;
      if (typeof v.x !== "number" || typeof v.y !== "number" || typeof v.w !== "number" || typeof v.h !== "number") {
        return;
      }
      const left = ((v.x - minX) / spanX) * 100;
      const top = ((v.y - minY) / spanY) * 100;
      const width = (v.w / spanX) * 100;
      const height = (v.h / spanY) * 100;
      mapped.push({
        id: `fill_${field.key || idx}`,
        text: "",
        role: "fillable_value",
        left: clamp(left, 0, 99.5),
        top: clamp(top, 0, 99.5),
        width: clamp(width, 1.2, 100),
        height: clamp(height, 1, 100),
      });
    });
  }

  const aspectRatio = Math.max(0.7, Math.min(1.8, spanY / spanX));
  return { tokens: mapped, aspectRatio };
}

function buildModelSyntheticTemplate(model: TemplateModel): {
  tokens: SyntheticToken[];
  aspectRatio: number;
} {
  const staticTokens = Array.isArray(model?.staticTokens) ? model.staticTokens : [];
  if (staticTokens.length === 0) {
    return { tokens: [], aspectRatio: 1.35 };
  }

  const minX = Math.min(...staticTokens.map((t) => t.bbox.x));
  const minY = Math.min(...staticTokens.map((t) => t.bbox.y));
  const maxX = Math.max(...staticTokens.map((t) => t.bbox.x + t.bbox.w));
  const maxY = Math.max(...staticTokens.map((t) => t.bbox.y + t.bbox.h));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const mapped = staticTokens.map((t) => ({
    id: t.id,
    text: t.text,
    role: (t.kind === "table_header" ? "table_header" : "fixed_text") as LayoutTokenRole,
    left: clamp(((t.bbox.x - minX) / spanX) * 100, 0, 99.5),
    top: clamp(((t.bbox.y - minY) / spanY) * 100, 0, 99.5),
    width: clamp((t.bbox.w / spanX) * 100, 0.6, 100),
    height: clamp((t.bbox.h / spanY) * 100, 0.8, 100),
  }));

  return {
    tokens: mapped,
    aspectRatio: Math.max(0.7, Math.min(1.8, spanY / spanX)),
  };
}

export default function TemplateCreatorModal({
  isOpen,
  category,
  categoryName,
  onClose,
  onSaved,
}: TemplateCreatorModalProps) {
  const tr = useTr();
  const [step, setStep] = useState<ModalStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [recognizedStructure, setRecognizedStructure] = useState<TemplateRecognitionResult | null>(null);
  const [templateLayout, setTemplateLayout] = useState<TemplateLayout | null>(null);
  const [templateModel, setTemplateModel] = useState<TemplateModel | null>(null);
  const [layoutQuality, setLayoutQuality] = useState<LayoutQuality | null>(null);
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<LayoutDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setPreviewImage(null);
    setTemplateName("");
    setRecognizedStructure(null);
    setTemplateLayout(null);
    setTemplateModel(null);
    setLayoutQuality(null);
    setLayoutDiagnostics(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError(tr("文件大小超过 50MB 限制"));
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      setError(tr("请上传图片或 PDF 文件"));
      return;
    }

    setError(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewImage(isImage ? dataUrl : null);
      setStep("recognizing");

      try {
        const base64 = dataUrl.split(",")[1];
        const response = await fetch("/api/template/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: file.type,
            templateName: `${categoryName}模板`,
          }),
        });

        const { data, text, isJson } = await parseJsonSafely(response);

        if (!isJson) {
          throw new Error(buildNonJsonApiError(response, text));
        }
        const payload = asObject(data);

        if (!response.ok) {
          throw new Error((payload.error as string) || tr("识别失败"));
        }

        if (payload.recognizedStructure) {
          setRecognizedStructure(normalizeRecognitionResult(payload.recognizedStructure));
        } else {
          setRecognizedStructure(normalizeRecognitionResult(payload));
        }
        if (payload.templateLayout) {
          setTemplateLayout(payload.templateLayout as TemplateLayout);
        }
        if (payload.templateModel) {
          setTemplateModel(payload.templateModel as TemplateModel);
        }
        if (payload.quality) {
          setLayoutQuality(payload.quality as LayoutQuality);
        }
        if (payload.diagnostics) {
          setLayoutDiagnostics(payload.diagnostics as LayoutDiagnostics);
        }
        setTemplateName(`${categoryName}模板`);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : tr("模板识别失败，请重试"));
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  }, [categoryName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleFieldLabelChange = (index: number, newLabel: string) => {
    if (!recognizedStructure) return;
    const newFields = [...recognizedStructure.companyInfo.fields];
    newFields[index] = { ...newFields[index], label: newLabel };
    setRecognizedStructure({
      ...recognizedStructure,
      companyInfo: { ...recognizedStructure.companyInfo, fields: newFields },
    });
  };

  const handleHeaderChange = (index: number, newHeader: string) => {
    if (!recognizedStructure) return;
    const newHeaders = [...recognizedStructure.tableHeaders];
    newHeaders[index] = newHeader;
    setRecognizedStructure({
      ...recognizedStructure,
      tableHeaders: newHeaders,
    });
  };

  const handleSummaryFieldChange = (index: number, newField: string) => {
    if (!recognizedStructure) return;
    const newFields = [...recognizedStructure.summaryFields];
    newFields[index] = newField;
    setRecognizedStructure({
      ...recognizedStructure,
      summaryFields: newFields,
    });
  };

  const handleSave = () => {
    if (!recognizedStructure || !templateName.trim()) return;
    if (layoutQuality && !layoutQuality.isQualified) {
      setError(tr("模板质量不足，无法保存。请重新上传更清晰、更完整的模板。"));
      return;
    }

    const companyFields = Array.isArray(recognizedStructure.companyInfo?.fields)
      ? recognizedStructure.companyInfo.fields
      : [];

    const template: CustomTemplate = {
      id: generateTemplateId(),
      name: templateName.trim(),
      category,
      createdAt: new Date().toISOString(),
      previewImage: previewImage || undefined,
      structure: {
        companyInfo: { fields: companyFields },
        tableHeaders: recognizedStructure.tableHeaders,
        tableFieldTypes: recognizedStructure.tableFieldTypes,
        summaryFields: recognizedStructure.summaryFields,
      },
      templateLayout: templateLayout
        ? {
            ...templateLayout,
            templateName: templateName.trim(),
            fields: templateLayout.fields.map((field) => {
              const matched = companyFields.find(
                (f) => f.key === field.key
              );
              return matched ? { ...field, label: matched.label } : field;
            }),
            table: {
              ...templateLayout.table,
              columns: templateLayout.table.columns.map((col, index) => ({
                ...col,
                label: recognizedStructure.tableHeaders[index] || col.label,
                semanticType: toSemanticType(
                  recognizedStructure.tableFieldTypes[index] || col.semanticType
                ),
              })),
            },
            summary: templateLayout.summary.map((item, index) => ({
              ...item,
              label: recognizedStructure.summaryFields[index] || item.label,
            })),
          }
        : undefined,
      templateModel: templateModel || undefined,
    };

    saveTemplate(template);
    onSaved(template);
    handleClose();
  };

  const hasLayoutAnchors = templateLayout
    ? collectLayoutBoxes(templateLayout).length > 0
    : false;
  const usesMockOcr = templateLayout
    ? templateLayout.warnings.some((w) => w.startsWith("backend_mock_ocr"))
    : false;
  const saveDisabled = !templateName.trim() || (layoutQuality ? !layoutQuality.isQualified : false);
  const layoutTokens = templateLayout && Array.isArray(templateLayout.tokens) ? templateLayout.tokens : [];
  const tokenRoleCounts = layoutTokens.length > 0
    ? layoutTokens.reduce<Record<string, number>>((acc, token) => {
        acc[token.role] = (acc[token.role] || 0) + 1;
        return acc;
      }, {})
    : {};
  const fallbackSyntheticTemplate = templateLayout ? buildSyntheticTemplate(templateLayout) : { tokens: [], aspectRatio: 1.35 };
  const modelSyntheticTemplate =
    templateModel && Array.isArray(templateModel.staticTokens) && templateModel.staticTokens.length > 0
      ? buildModelSyntheticTemplate(templateModel)
      : null;
  const syntheticTemplate = modelSyntheticTemplate || fallbackSyntheticTemplate;
  const syntheticPreviewTokens = syntheticTemplate.tokens.filter(
    (token) =>
      token.role === "fixed_text" ||
      token.role === "table_header" ||
      likelyTemplateLabel(token.text) ||
      (token.role === "fillable_value" && token.text.trim().length === 0)
  );
  const tablePreview = templateModel?.table
    ? { headers: templateModel.table.columns.map((c) => c.label), rows: templateModel.table.sampleRows }
    : templateLayout && recognizedStructure
      ? buildTablePreview(templateLayout, recognizedStructure)
      : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{tr(`创建${categoryName}模板`)}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {step === "upload" && tr("上传您公司的单据截图作为模板")}
              {step === "recognizing" && tr("AI 正在识别表单结构...")}
              {step === "preview" && tr("确认识别结果并保存模板")}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-slate-600 mb-2">{tr("拖拽图片到这里，或")}</p>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all">
                  {tr("选择文件")}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-400 mt-4">{tr("支持 JPG、PNG、PDF，最大 50MB")}</p>
            </div>
          )}

          {step === "recognizing" && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-500 flex items-center justify-center animate-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" />
                  <path d="M8.25 9.93A4 4 0 0 1 12 2" />
                  <path d="M12 22a4 4 0 0 1-4-4c0-1.95 1.4-3.58 3.25-3.93" />
                  <path d="M15.75 14.07A4 4 0 0 1 12 22" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">{tr("AI 正在识别模板结构")}</h3>
              <p className="text-sm text-slate-400">{tr("正在分析表头、字段类型和表单布局...")}</p>
              {previewImage && (
                <div className="mt-6">
                  <img src={previewImage} alt={tr("模板预览")} className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                </div>
              )}
            </div>
          )}

          {step === "preview" && recognizedStructure && (
            <div className="space-y-6">
              {/* Template name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{tr("模板名称")}</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tr("输入模板名称")}
                />
              </div>

              {/* Preview image */}
              {previewImage && !templateLayout && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{tr("原始截图")}</label>
                  <img src={previewImage} alt={tr("模板预览")} className="max-h-40 rounded-lg border border-slate-200" />
                </div>
              )}

              {templateLayout && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{tr("模板预览")}</label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {syntheticPreviewTokens.length > 0 ? (
                      <div
                        className="relative w-full rounded-lg border border-slate-300 bg-white overflow-hidden"
                        style={{ aspectRatio: `${1 / syntheticTemplate.aspectRatio}` }}
                      >
                        {syntheticPreviewTokens.map((token) => (
                          <div
                            key={`synthetic-token-${token.id}`}
                            className={`absolute border rounded-sm ${tokenRoleClass(token.role)}`}
                            style={{
                              left: `${token.left}%`,
                              top: `${token.top}%`,
                              width: `${Math.max(2, token.width)}%`,
                              height: `${Math.max(2, token.height)}%`,
                              fontSize: "10px",
                              lineHeight: "1.1",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              padding: "1px 2px",
                            }}
                            title={`${token.role}: ${token.text}`}
                          >
                            <span className={tokenTextClass(token.role, token.text)}>
                              {token.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-300 bg-white p-4 text-xs text-slate-500">
                        {tr("当前未生成可用于仿真布局的文本坐标。")}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      {tr("浅蓝: 固定文本 | 绿色: 待填写值 | 橙色: 表头 | 紫色: 表格单元")}
                    </p>
                    {layoutTokens.length > 0 && (
                      <p className="mt-1 text-xs text-slate-600">
                        {tr("全量文本块")}: {layoutTokens.length}（{tr("固定")}:{tokenRoleCounts.fixed_text || 0}，{tr("待填")}:{tokenRoleCounts.fillable_value || 0}，{tr("表头")}:{tokenRoleCounts.table_header || 0}，{tr("表格")}:{tokenRoleCounts.table_cell || 0}）
                      </p>
                    )}
                    {usesMockOcr && (
                      <p className="mt-1 text-xs text-amber-700">
                        {tr("当前为 Mock OCR 坐标，仅用于流程演示，位置可能与真实模板不一致。")}
                      </p>
                    )}
                    {!hasLayoutAnchors && (
                      <p className="mt-1 text-xs text-amber-600">
                        {tr("当前模板暂无坐标锚点，请重新上传更清晰或更完整的模板。")}
                      </p>
                    )}
                  </div>

                  {tablePreview && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-medium text-slate-600">{tr("模板表格预览")}</p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-xs">
                          <thead>
                            <tr>
                              {tablePreview.headers.map((header, idx) => (
                                <th
                                  key={`tpl-th-${idx}`}
                                  className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold text-slate-700"
                                >
                                  {header || `${tr("列")}${idx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tablePreview.rows.map((row, rIdx) => (
                              <tr key={`tpl-row-${rIdx}`}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={`tpl-cell-${rIdx}-${cIdx}`}
                                    className="border border-slate-200 px-2 py-1 text-slate-500"
                                  >
                                    {cell || "\u00A0"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {layoutQuality && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                  layoutQuality.isQualified
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  <p className="font-medium">
                    {tr("模板质量")}: {layoutQuality.isQualified ? tr("合格") : tr("不合格")}
                  </p>
                  <p>
                    OCR Token: {layoutQuality.ocrTokenCount}，{tr("锚点覆盖")}: {layoutQuality.anchoredFields}/{layoutQuality.totalFields} ({Math.round(layoutQuality.anchorRate * 100)}%)，{tr("置信度")}: {layoutQuality.confidence.toFixed(3)}
                  </p>
                  {!layoutQuality.isQualified && layoutQuality.failures.length > 0 && (
                    <p className="mt-1 text-xs">
                      {tr("原因")}: {layoutQuality.failures.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {layoutDiagnostics && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p>
                    {tr("解析通道")}: {layoutDiagnostics.pipeline} | OCR: {layoutDiagnostics.ocrProvider} | {tr("Token来源")}: {layoutDiagnostics.tokenSource}
                  </p>
                  <p>
                    {tr("主问题")}: {layoutDiagnostics.primaryIssue}
                  </p>
                  {layoutDiagnostics.warnings.length > 0 && (
                    <p>Warnings: {layoutDiagnostics.warnings.join(", ")}</p>
                  )}
                </div>
              )}

              {/* Company info fields */}
              {recognizedStructure.companyInfo.fields.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {tr("公司信息字段")} ({recognizedStructure.companyInfo.fields.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recognizedStructure.companyInfo.fields.map((field, i) => (
                      <input
                        key={i}
                        type="text"
                        value={field.label}
                        onChange={(e) => handleFieldLabelChange(i, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Table headers */}
              {recognizedStructure.tableHeaders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {tr("表格列")} ({recognizedStructure.tableHeaders.length})
                  </label>
                  <div className="overflow-x-auto">
                    <div className="flex gap-2 pb-2">
                      {recognizedStructure.tableHeaders.map((header, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={header}
                            onChange={(e) => handleHeaderChange(i, e.target.value)}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                          />
                          <span className="text-xs text-slate-400 text-center">
                            {recognizedStructure.tableFieldTypes[i] || "text"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary fields */}
              {recognizedStructure.summaryFields.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {tr("汇总字段")} ({recognizedStructure.summaryFields.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recognizedStructure.summaryFields.map((field, i) => (
                      <input
                        key={i}
                        type="text"
                        value={field}
                        onChange={(e) => handleSummaryFieldChange(i, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={resetState}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {tr("重新上传")}
            </button>
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tr("保存模板")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
