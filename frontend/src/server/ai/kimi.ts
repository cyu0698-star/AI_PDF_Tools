import {
  TemplateType,
  TemplateRecognitionResult,
  DataExtractionResult,
} from "@/features/documents/types";
import {
  isSupportedVisionImageMimeType,
  isPdfMimeType,
} from "@/server/layout/fileTypes.mjs";
import { buildLowConfidenceFields } from "@/server/layout/confidence.mjs";
import { fetchBackend, friendlyBackendError } from "@/lib/fetchBackend.mjs";
import {
  mapCompanyInfo,
  mapSummary,
  mapTableRows,
} from "@/server/layout/extractionMap.mjs";

// NOTE: All AI calls now go through the backend Python service via
// callAIViaBackend → /api/ai-vision → Anthropic Claude. The file name
// `kimi.ts` is kept for backward-compat with existing imports; the legacy
// Kimi/Moonshot direct-API code (callKimi, uploadFileToKimi, getFileContent,
// KIMI_* constants incl. a hardcoded fallback key) was removed.

const TEMPLATE_PROMPTS: Record<TemplateType, string> = {
  delivery_note: `你是一个专业的财务文件识别助手。请从上传的文件中提取送货单信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["日期", "品名", "规格", "数量", "单价", "金额", "备注"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount(总金额), documentDate(单据日期), supplier(供应商/客户), documentType(单据类型), documentNumber(单据编号)
注意：请忽略盖章、印章、签名等信息。只返回 JSON。`,
  reconciliation: `你是一个专业的财务文件识别助手。请从上传的文件中提取对账单信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["日期", "摘要", "借方金额", "贷方金额", "余额", "备注"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount, documentDate, supplier, documentType, documentNumber
注意：请忽略盖章、印章、签名等信息。只返回 JSON。`,
  purchase_order: `你是一个专业的财务文件识别助手。请从上传的文件中提取采购单信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["序号", "品名", "规格型号", "单位", "数量", "单价", "金额"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount, documentDate, supplier, documentType, documentNumber
注意：请忽略盖章、印章、签名等信息。只返回 JSON。`,
  bank_statement: `你是一个专业的财务文件识别助手。请从上传的文件中提取银行流水/对账信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["交易日期", "交易类型", "对方账户", "摘要", "收入", "支出", "余额"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount, documentDate, supplier, documentType, documentNumber
注意：请忽略盖章、印章、签名等信息。只返回 JSON。`,
  payment_list: `你是一个专业的财务文件识别助手。请从上传的文件中提取支付清单信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["序号", "收款方", "账号", "金额", "用途", "日期", "状态"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount, documentDate, supplier, documentType, documentNumber
注意：请忽略盖章、印章、签名等信息。只返回 JSON。`,
  quotation: `你是一个专业的财务文件识别助手。请从上传的文件中提取报价单信息，并以 JSON 格式返回。
请提取以下字段：
- headers: 表头数组，例如 ["序号", "规格", "公斤", "数量/公斤", "单价", "金额", "备注"]
- rows: 数据行数组，每行是一个对象
- summary: 摘要信息，包含 totalAmount, documentDate, supplier, documentType, documentNumber, contact, address
注意：请忽略盖章、印章、签名、水印等信息。只返回 JSON。`,
};

// Generic AI vision call that routes through the Python backend
// (/api/ai-vision). Avoids the Anthropic Cloudflare 403 that hits Node fetch
// directly. Returns the parsed JSON object directly.
async function callAIViaBackend(
  fileBase64: string,
  mimeType: string,
  prompt: string,
  maxTokens: number = 4096
): Promise<Record<string, unknown>> {
  const resp = await fetchBackend("/api/ai-vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, mimeType, prompt, maxTokens }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(friendlyBackendError(resp.status, errBody));
  }
  const data = (await resp.json()) as { result?: Record<string, unknown> };
  return data.result || {};
}

export async function processDocument(
  fileBase64: string,
  mimeType: string,
  templateType: TemplateType
) {
  if (!isPdfMimeType(mimeType) && !isSupportedVisionImageMimeType(mimeType)) {
    throw new Error(`不支持的文件类型: ${mimeType || "unknown"}。仅支持 PDF 或图片。`);
  }
  const prompt = TEMPLATE_PROMPTS[templateType];
  const parsed = await callAIViaBackend(fileBase64, mimeType, prompt, 4096);
  return {
    headers: (parsed.headers as string[]) || [],
    rows: (parsed.rows as Record<string, string>[]) || [],
    summary: (parsed.summary as Record<string, string>) || {},
    rawText: "",
  };
}

export async function recognizeTemplateStructure(
  fileBase64: string,
  mimeType: string
): Promise<TemplateRecognitionResult> {
  if (!isSupportedVisionImageMimeType(mimeType)) {
    throw new Error(`模板识别仅支持图片文件（JPG/PNG/WEBP），当前类型: ${mimeType || "unknown"}`);
  }

  const prompt = `你是一个专业的表单结构分析助手。请分析上传的单据/表单图片，识别其结构并以 JSON 格式返回。

# 任务
请识别这张单据/表单的版式结构，输出以下四类信息：

1. **companyInfo.fields** — 顶部抬头的公司/联系信息字段。每个对象 { key, label, type, required }：
   - key 用英文短词（companyName, address, phone, fax, mobile, taxId, ...）
   - label 用中文显示名
   - type ∈ "text" | "number" | "date"
   - required 是布尔
2. **tableHeaders** — 中间明细表的列名数组，按视觉从左到右顺序。如"序号""规格""数量""单价""金额""备注"等
3. **tableFieldTypes** — 与 tableHeaders 长度一致的类型数组，每一项 ∈ "text" | "number" | "date"
4. **summaryFields** — 表外的汇总/客户字段，如"送货单号""客户名称""收货地址""合计金额"等

# 规则
- 只识别**模板里有的标签**，不要凭空臆造字段
- "客户信息"放 summaryFields，"我方公司信息"（抬头那一区）放 companyInfo
- 表头是"序号 规格 数量 单价 金额 备注"的话，tableHeaders 就是 ["序号","规格","数量","单价","金额","备注"]，tableFieldTypes 对应是 ["number","text","number","number","number","text"]

# 输出（只返回 JSON，无任何前后文）
{
  "companyInfo": { "fields": [ { "key":"...", "label":"...", "type":"text", "required":false } ] },
  "tableHeaders": [ "...", "..." ],
  "tableFieldTypes": [ "text", "number" ],
  "summaryFields": [ "...", "..." ]
}`;

  const parsed = await callAIViaBackend(fileBase64, mimeType, prompt, 4096);

  // Claude tends to over-engineer arrays — coerce to the shapes that the
  // downstream normalizer (`normalizeStringArray`, `normalizeFieldType`) expects.
  const coerceToStringArray = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return (
            (typeof o.label === "string" && o.label.trim()) ||
            (typeof o.key === "string" && o.key.trim()) ||
            ""
          );
        }
        return "";
      })
      .filter((s) => s.length > 0);
  };
  const coerceFieldTypes = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      const raw = typeof item === "string" ? item.toLowerCase() : "";
      if (raw === "number" || raw === "currency" || raw === "int" || raw === "integer" || raw === "index") return "number";
      if (raw === "date" || raw === "datetime" || raw === "time") return "date";
      return "text";
    });
  };

  return {
    companyInfo: (parsed.companyInfo as TemplateRecognitionResult["companyInfo"]) || { fields: [] },
    tableHeaders: coerceToStringArray(parsed.tableHeaders),
    tableFieldTypes: coerceFieldTypes(parsed.tableFieldTypes),
    summaryFields: coerceToStringArray(parsed.summaryFields),
  };
}

export async function classifyTemplateTokensByVision(
  fileBase64: string,
  mimeType: string,
  tokens: Array<{
    id: string;
    text: string;
    bbox: { x: number; y: number; w: number; h: number };
  }>
): Promise<{
  fixedTokenIds: string[];
  variableTokenIds: string[];
  tableHeaderTokenIds: string[];
}> {
  if (!isSupportedVisionImageMimeType(mimeType)) {
    return { fixedTokenIds: [], variableTokenIds: [], tableHeaderTokenIds: [] };
  }

  const compactTokens = tokens
    .filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.text === "string" &&
        t.text.trim().length > 0 &&
        t.bbox &&
        typeof t.bbox.x === "number" &&
        typeof t.bbox.y === "number" &&
        typeof t.bbox.w === "number" &&
        typeof t.bbox.h === "number"
    )
    .slice(0, 360)
    .map((t) => ({
      id: t.id,
      text: t.text.trim(),
      bbox: {
        x: Number(t.bbox.x.toFixed(1)),
        y: Number(t.bbox.y.toFixed(1)),
        w: Number(t.bbox.w.toFixed(1)),
        h: Number(t.bbox.h.toFixed(1)),
      },
    }));

  if (compactTokens.length === 0) {
    return { fixedTokenIds: [], variableTokenIds: [], tableHeaderTokenIds: [] };
  }

  const prompt = `你是模板版式语义分析器。你会收到一张票据图片和 OCR tokens（含 id/text/bbox 像素坐标）。

# 任务
判断每个 token 属于以下三类中的哪一类，输出每类的 token id 列表。

## 分类规则

1. **fixedTokenIds** — 模板的"固定文本"层。这些是每次填写时**不会变**的内容：
   - 公司 logo 名 / 公司全称（如"惠州市罗丰实业有限公司"）
   - 字段标签（"地址："、"电话："、"客户名称："）
   - 固定说明（"注：以上货品请核对清楚..."、"送货方签名盖章："）
   - 单据标题（"送 货 单"、"采 购 单"）

2. **variableTokenIds** — "每次会变"的数据：
   - 单号、日期、具体地址值、具体电话号码
   - 数量、单价、金额、商品明细的具体值
   - 注意：如果 token 文本是"产品名称: xxx"这种带值的，整体归 variable
   - 注意：如果只有"产品名称"四个字、且位于表格表头位置，归 tableHeader 不归 variable

3. **tableHeaderTokenIds** — 明细表的列名（通常也是固定文本的一部分，但单独标记）：
   - "序号"、"订单号"、"物料代码"、"产品名称"、"单位"、"数量"、"单价"、"金额"、"备注"

## 严格要求
- 只能使用输入里**出现过的** token id（输入会以 \`OCR tokens:\` 后接 JSON 给出）
- **不要编造 id、不要省略 id**：每个 id 必须精确出现在恰好 1 个分类里
- 输出必须是合法 JSON，无任何前后文、无 markdown 代码块

# 输出格式
{"fixedTokenIds":["..."],"variableTokenIds":["..."],"tableHeaderTokenIds":["..."]}

OCR tokens:
${JSON.stringify(compactTokens)}`;

  const parsed = await callAIViaBackend(fileBase64, mimeType, prompt, 4096);

  const asIdArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((v) => typeof v === "string" && v.trim().length > 0)
      : [];

  return {
    fixedTokenIds: asIdArray(parsed.fixedTokenIds),
    variableTokenIds: asIdArray(parsed.variableTokenIds),
    tableHeaderTokenIds: asIdArray(parsed.tableHeaderTokenIds),
  };
}

export async function extractDataToTemplate(
  fileBase64: string,
  mimeType: string,
  templateStructure: {
    companyInfo: { fields: Array<{ key: string; label: string }> };
    tableHeaders: string[];
    summaryFields: string[];
  },
  options?: {
    templateLayout?: {
      fields?: Array<{ key: string; label: string; confidence?: number }>;
    } | null;
    ocrTokens?: Array<{
      text: string;
      bbox?: { x: number; y: number; w: number; h: number };
    }> | null;
  }
): Promise<DataExtractionResult> {
  const companyFields = templateStructure.companyInfo.fields;
  const companyFieldsBlock = companyFields.length > 0
    ? companyFields.map((f) => `  - key=${f.key}, 含义=${f.label}`).join("\n")
    : "  （无）";
  const tableHeaders = templateStructure.tableHeaders;
  const tableHeadersBlock = tableHeaders.length > 0
    ? tableHeaders.map((h, i) => `  ${i + 1}. ${h}`).join("\n")
    : "  （无）";
  const summaryFieldsBlock = templateStructure.summaryFields.length > 0
    ? templateStructure.summaryFields.map((f) => `  - ${f}`).join("\n")
    : "  （无）";

  // Strict prompt — explicit column semantics, conservative "leave empty if
  // not sure" rule, and an example of the wrong-vs-right column alignment.
  const prompt = `你是结构化数据提取引擎。请从上传的原始单据（图片或PDF）中提取数据，并严格按下方"模板字段定义"返回 JSON。

# 模板字段定义

## 公司信息字段（key → 中文含义）
${companyFieldsBlock}

## 明细表列（按顺序排列；这是收单方的模板列，不一定能在原单据里找到完全对应列）
${tableHeadersBlock}

## 汇总字段
${summaryFieldsBlock}

# 提取规则（违反任意一条都会被视为错误输出）

1. **不要瞎填**。如果原单据里某个字段确实没有，就填空字符串 ""（汇总/公司字段）或 null（明细行字段）。**禁止把内容塞到任何其它字段以"填满"它**。
2. **明细表列必须按语义精确对应**：
   - "序号" 只能填阿拉伯数字（1, 2, 3...），不要把原单的物料代码当序号
   - "订单号" 只能填明确的订单/合同编号字符串；如果原单某行没有订单号就填空
   - "物料代码" / "物料编码" 只能填物料编号/料号；不要把规格、产品名混进来
   - "产品名称" / "品名" 只能填产品的名称或描述；不要把规格、单位混进来
   - "规格" / "规格型号" 只能填规格描述（如 0.8*57, M2.5 等）
   - "单位" 只能填计量单位（PC、公斤、个、件等）
   - "数量" 只能是数字
   - "单价" 只能是数字
   - "金额" / "总额" 只能是数字（通常= 数量 × 单价；如果原单留空就填空）
   - "备注" 只能填备注/说明性文字（如 "65M钢材料"、颜色、特殊要求等）；**任何不属于其它列的描述性文字才放这里**
3. **逐列严格对位**：明细表每一行返回的对象必须只包含上面"明细表列"里列出的字段名作为 key（不要加新 key、不要加序号自动列）。
4. **汇总字段是"收货方/客户信息"，不是供应商信息**：
   - 如果模板里有"客户名称"、"客户地址"、"客户电话"这类字段，**只填原单据里明确属于"客户/收货方/送货至"的内容**
   - **绝对不要把"供应商/制单方/我方"的地址电话塞进客户字段**
5. 公司字段同理：填写原单据里能对应该字段含义的真实值；不能确定就填空字符串。
6. 只返回一个 JSON 对象，不要加任何前后文、不要 markdown 代码块。

# 返回 JSON 格式
\`\`\`
{
  "companyInfo": { "<key>": "<value>", ... },
  "tableRows": [
    { "<明细列名1>": "<值或空>", "<明细列名2>": "<值或空>", ... },
    ...
  ],
  "summary": { "<汇总字段名>": "<值或空>", ... }
}
\`\`\`

# 错误示范（务必避免）
- ❌ 把 "65M钢材料"（明显是材质备注）放进"总额"列
- ❌ 把 "0.8*57"（规格）放进"物料代码"列
- ❌ 把 "广东惠州...新精丰"（这是我方公司地址）放进"客户地址"列
- ❌ 因为模板有"产品名称"列就硬编一个值填进去

现在请认真提取并返回 JSON。`;

  if (!isPdfMimeType(mimeType) && !isSupportedVisionImageMimeType(mimeType)) {
    throw new Error(`不支持的文件类型: ${mimeType || "unknown"}。模板提取目前仅支持 PDF 或图片。`);
  }

  // Route through backend Python service. Direct Node.js fetch to Anthropic
  // is blocked by Cloudflare with 403 forbidden — backend httpx works.
  // The strict prompt above is now mirrored inside backend/template_extract.py;
  // we just need to forward the structured request here.
  void prompt; // kept above for source-of-truth comparison vs backend
  const backendResp = await fetchBackend("/api/template-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      mimeType,
      templateStructure: {
        companyInfo: { fields: companyFields },
        tableHeaders,
        summaryFields: templateStructure.summaryFields,
      },
    }),
  });
  if (!backendResp.ok) {
    const errBody = await backendResp.text();
    throw new Error(friendlyBackendError(backendResp.status, errBody));
  }
  const parsed = (await backendResp.json()) as Record<string, unknown>;
  const rawCompanyInfo = (parsed.companyInfo as Record<string, unknown>) || {};
  const rawTableRows =
    (parsed.tableRows as Array<Record<string, unknown> | unknown[]>) ||
    (parsed.rows as Array<Record<string, unknown> | unknown[]>) ||
    [];
  const rawSummary = (parsed.summary as Record<string, unknown>) || {};
  const companyInfo = mapCompanyInfo(
    rawCompanyInfo,
    templateStructure.companyInfo.fields
  ) as Record<string, string>;
  const tableRows = mapTableRows(
    rawTableRows,
    templateStructure.tableHeaders
  ) as Record<string, string>[];
  const summary = mapSummary(
    rawSummary,
    templateStructure.summaryFields
  ) as Record<string, string>;
  const lowConfidenceFields =
    options?.templateLayout?.fields && options.templateLayout.fields.length > 0
      ? buildLowConfidenceFields({
          templateLayout: options.templateLayout,
          companyInfo,
          ocrTokens: options?.ocrTokens || [],
        })
      : [];

  return {
    companyInfo,
    tableRows,
    summary,
    lowConfidenceFields,
  };
}
