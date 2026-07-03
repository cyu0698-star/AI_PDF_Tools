// English translations. Keys are the Chinese source strings — so if a string
// in the codebase isn't in this map, we fall back to showing the Chinese
// (graceful degradation) and you'll know exactly which key to add.
//
// To add or change a translation: copy the exact Chinese text from the source
// file and add it as a key here.
//
// Server-side strings (AI prompts, error messages) and client-side strings
// (UI labels, buttons) all live in this one dictionary.

export const EN_DICT: Record<string, string> = {
  // --- Layout / metadata ---
  "I Love 财务表单 - AI 智能财务文件处理": "I Love Financial Forms — AI-powered financial document processing",
  "AI 驱动的财务文件自动化处理平台，一键转换财务文件为标准化表单":
    "AI-powered platform that turns financial documents into standardized spreadsheets in one click",

  // --- Login page ---
  "访问验证": "Access verification",
  "请输入访问密码以继续使用 I Love 财务表单。":
    "Enter the access password to continue using I Love Financial Forms.",
  "访问密码": "Access password",
  "请输入访问密码": "Enter the access password",
  "请输入有效的手机号": "Please enter a valid phone number",
  "请输入手机号": "Please enter your phone number",
  "请输入验证码": "Please enter the verification code",
  "验证中…": "Verifying…",
  "进入": "Enter",
  "密码错误，请重试": "Wrong password, please try again",
  "登录失败，请检查网络后重试": "Login failed — please check your network and retry",

  // --- Dashboard ---
  "上传与识别": "Upload & Recognize",
  "选择模板后上传原始单据，AI自动提取数据生成标准化文件":
    "Pick a template, upload your document, and AI will extract data into a standardized file",
  "免费试用": "Free trial",
  "文档生成": "Document generation",
  "充值": "Top up",
  "模版选择": "Template selection",
  "选择已有模板或上传新模板，然后上传原始单据进行数据提取。":
    "Pick an existing template or upload a new one, then upload your document to extract data.",
  "销售业务": "Sales",
  "送货单": "Delivery note",
  "对账单": "Reconciliation",
  "采购单": "Purchase order",
  "报价单": "Quotation",
  "财务业务": "Finance",
  "流水对账": "Bank statement",
  "支付清单": "Payment list",
  "送货单模板": "Delivery note template",
  "对账单模板": "Reconciliation template",
  "采购单模板": "Purchase order template",
  "报价单模板": "Quotation template",
  "流水对账模板": "Bank statement template",
  "支付清单模板": "Payment list template",
  "上传送货单模板": "Upload delivery note template",
  "上传对账单模板": "Upload reconciliation template",
  "上传采购单模板": "Upload purchase order template",
  "上传报价单模板": "Upload quotation template",
  "上传流水对账模板": "Upload bank statement template",
  "上传支付清单模板": "Upload payment list template",
  "智能转换（无需选择模板，直接生成 Excel）":
    "Smart convert (no template needed — generate Excel directly)",
  "上传 Excel 模板（可选）": "Upload Excel template (optional)",
  "选择文件": "Choose file",
  "当前状态": "Current status",
  "已上传1个文档": "1 document uploaded",
  "已上传 %d 个文档": "%d documents uploaded",
  "当前流程每次仅处理 1 个文件（PDF/图片）。":
    "This flow processes one file at a time (PDF or image).",
  "下一步：选择或创建模板": "Next: pick or create a template",
  "开始生成": "Generate",
  "使用说明：": "How to use:",
  "1. 点击\"上传XX模板\"创建新模板": "1. Click \"Upload XX template\" to create a new template",
  "2. 选择已有模板后，上传原始单据": "2. Pick an existing template, then upload your document",
  "3. AI 将自动提取数据并填充": "3. AI will extract the data and fill it in automatically",

  // --- Template creator modal ---
  "创建送货单模板": "Create delivery note template",
  "创建对账单模板": "Create reconciliation template",
  "创建采购单模板": "Create purchase order template",
  "创建报价单模板": "Create quotation template",
  "创建流水对账模板": "Create bank statement template",
  "创建支付清单模板": "Create payment list template",
  "上传您公司的单据截图作为模板": "Upload a screenshot of your company's document as the template",
  "拖拽图片到这里，或": "Drag an image here, or",
  "支持 JPG、PNG、PDF，最大 50MB": "JPG, PNG, PDF supported, up to 50MB",
  "分析模板中…": "Analyzing template…",
  "保存模板": "Save template",
  "取消": "Cancel",
  "模板名称": "Template name",
  "请输入模板名称": "Enter a template name",
  "公司信息字段": "Company info fields",
  "明细表表头": "Detail table headers",
  "汇总字段": "Summary fields",
  "全量文本块": "Total text blocks",
  "固定": "Fixed",
  "待填": "Fillable",
  "表头": "Header",
  "表格": "Cells",
  "列": "Col",
  "锚点覆盖": "Anchor coverage",
  "置信度": "Confidence",
  "原因": "Reason",
  "解析通道": "Parser pipeline",
  "Token来源": "Token source",
  "主问题": "Main issue",
  "添加字段": "Add field",
  "删除": "Delete",
  "上移": "Move up",
  "下移": "Move down",
  "字段名": "Field name",
  "字段类型": "Field type",
  "文本": "Text",
  "数字": "Number",
  "日期": "Date",
  "必填": "Required",
  "模板已保存": "Template saved",
  "模板保存失败": "Failed to save template",
  "模板分析失败": "Failed to analyze template",
  "请先上传图片": "Please upload an image first",

  // --- Upload modal / zone ---
  "上传原始单据": "Upload your document",
  "拖拽文件到这里，或": "Drag a file here, or",
  "支持 PDF 和图片（JPG/PNG）": "PDF and images (JPG/PNG) supported",
  "文件过大": "File too large",
  "不支持的文件类型": "Unsupported file type",

  // --- Result view / editable form ---
  "识别结果": "Recognition result",
  "下载 Excel": "Download Excel",
  "重新上传": "Upload again",
  "编辑数据": "Edit data",
  "保存": "Save",
  "重置": "Reset",
  "处理中…": "Processing…",
  "正在识别…": "Recognizing…",
  "正在生成 Excel…": "Generating Excel…",
  "识别失败": "Recognition failed",
  "下载失败": "Download failed",

  // --- Status bar / sidebar ---
  "当前状态：": "Current status: ",
  "当前状态：已生成文稿": "Current status: document generated",
  "当前状态：编辑表单中": "Current status: editing form",
  "当前状态：AI 正在处理中...": "Current status: AI is processing…",
  "当前状态：已上传1个文档": "Current status: 1 document uploaded",
  "当前状态：已上传 %d 个文档": "Current status: %d documents uploaded",
  "OCR 服务不可用": "OCR service unavailable",
  "模板识别仅支持图片文件（JPG/PNG/WEBP），当前类型": "Template recognition only supports image files (JPG/PNG/WEBP); received type",
  "模板识别当前仅支持图片（JPG/PNG/WEBP）。收到类型": "Template recognition currently only supports images (JPG/PNG/WEBP). Received type",
  "转换完成！Excel 已自动下载": "Conversion complete! Your Excel has been downloaded",
  "已保存到浏览器下载目录，请打开核对数据后再使用": "Saved to your browser's Downloads folder — open it and verify the data before use",
  "再次下载": "Download again",
  "继续转换下一份": "Convert another document",
  "下一步：点击下载": "Next: click download",
  "编辑完成后可导出": "Export when you finish editing",
  "请等待处理完成": "Please wait for processing to finish",
  "下一步：上传原始单据": "Next: upload your document",
  "下一步：点击开始提取数据": "Next: click to start extracting data",
  "开始下载": "Start download",
  "已上传": "Uploaded",
  "处理中": "Processing",
  "已完成": "Completed",
  "未开始": "Not started",
  "失败": "Failed",

  // --- Sidebar / demo animation ---
  "I Love 财务表单": "I Love Financial Forms",
  "财务文件秒变标准表单": "Turn financial documents into standardized forms in seconds",
  "上传单据": "Upload document",
  "AI 识别": "AI recognition",
  "导出 Excel": "Export Excel",

  // --- Common ---
  "确定": "OK",
  "关闭": "Close",
  "返回": "Back",
  "下一步": "Next",
  "上一步": "Previous",
  "加载中…": "Loading…",
  "未知错误": "Unknown error",
  "确认": "Confirm",
  "退出登录": "Sign out",

  // --- Dashboard extras ---
  "编辑表单": "Edit form",
  "编辑AI提取的数据，完成后可导出下载": "Edit the data AI extracted; you can export and download when done",
  "智能转换工作流": "Smart conversion workflow",
  "AI 正在转换中...": "AI is converting…",
  "智能转换（填入你的模板）": "Smart convert (fill into your template)",
  "处理失败": "Processing failed",
  "处理失败，请重试": "Processing failed, please retry",
  "智能转换失败": "Smart conversion failed",
  "智能转换失败，请重试": "Smart conversion failed, please retry",
  "数据提取失败": "Data extraction failed",
  "对齐失败时语义降级": "Fall back to semantic mode if alignment fails",
  "开启后，若坐标对齐失败仍继续提取数据，但不保证版式坐标准确。":
    "When enabled, if coordinate alignment fails the system still extracts data, but layout positions may be inaccurate.",
  "允许降级": "Allow fallback",
  "AI 正在提取数据...": "AI is extracting data…",
  "AI 正在解析文档...": "AI is parsing the document…",
  "正在从原始单据提取数据并映射到模板字段": "Extracting data from your document and mapping to template fields",
  "正在识别文档结构、提取关键数据并生成标准化表单": "Recognizing document structure, extracting key data, and generating a standardized form",
  "字段匹配": "Field matching",
  "数据提取": "Data extraction",
  "格式转换": "Format conversion",
  "数值解析": "Number parsing",
  "智能填充": "Smart fill",
  "表头识别": "Header detection",
  "金额提取": "Amount extraction",
  "日期解析": "Date parsing",
  "供应商匹配": "Supplier matching",
  "格式标准化": "Format normalization",
  "当前提取模式: 语义降级。原因: 模板对齐质量不足，本次未使用坐标对齐，仅按语义字段提取。":
    "Current extraction mode: semantic fallback. Reason: template alignment quality was insufficient, so coordinate alignment was skipped and only semantic fields were extracted.",

  // --- Login extras ---
  "© I Love 财务表单 2026": "© I Love Financial Forms 2026",

  // --- Demo animation ---
  "上传文档": "Upload document",
  "拖拽或选择财务文件": "Drag or pick a financial file",
  "AI 智能解析": "AI smart parsing",
  "深度理解文档结构与内容": "Deep understanding of document structure and content",
  "生成标准表单": "Generate standardized form",
  "自动匹配模版，填充结构化数据": "Auto-match templates and fill in structured data",
  "转换完成": "Conversion complete",
  "原始文件 → 标准化表单": "Original file → standardized form",
  "AI 驱动": "AI-powered",
  "，一键转换财务文件。": ", convert financial documents in one click.",
  "上传任意格式的财务文档，AI 自动识别、提取、标准化，秒级生成规范表单。":
    "Upload financial documents in any format. AI recognizes, extracts, and standardizes them — generating a polished form in seconds.",
  "正在识别...": "Recognizing…",
  "解析完成": "Parsing complete",
  "原始文件": "Original file",
  "标准表单": "Standardized form",
  "供应商": "Supplier",
  "品名": "Item",
  "数量": "Quantity",
  "金额": "Amount",

  // --- Sidebar extras ---
  "133****3333": "133****3333",

  // --- Upload zone / modal ---
  "文件大小限制 50MB": "File size limit 50MB",
  "在你的电脑中选择文件": "Choose a file from your computer",
  "上传文件": "Upload file",
  "每次最多可上传一个文件，单个文件大小上限为50 MB。":
    "You can upload one file at a time, up to 50 MB.",
  "点击上传": "Click to upload",
  "或者拖拽到这里": "or drag here",
  "支持 PDF/JPG/PNG/WEBP": "PDF / JPG / PNG / WEBP supported",

  // --- Template selector ---
  "确定要删除这个模板吗？": "Delete this template?",
  "上传": "Upload",
  "模板": "template",

  // --- Template creator extras ---
  "AI 正在识别表单结构...": "AI is recognizing the form structure…",
  "确认识别结果并保存模板": "Confirm the recognition result and save the template",
  "模板预览": "Template preview",
  "原始截图": "Original screenshot",
  "AI 正在识别模板结构": "AI is recognizing the template structure",
  "正在分析表头、字段类型和表单布局...": "Analyzing headers, field types, and form layout…",
  "输入模板名称": "Enter a template name",
  "文件大小超过 50MB 限制": "File exceeds the 50MB limit",
  "请上传图片或 PDF 文件": "Please upload an image or PDF",
  "模板质量不足，无法保存。请重新上传更清晰、更完整的模板。":
    "Template quality is insufficient — please re-upload a clearer or more complete template.",
  "当前未生成可用于仿真布局的文本坐标。": "No text coordinates available for the synthetic layout preview.",
  "浅蓝: 固定文本 | 绿色: 待填写值 | 橙色: 表头 | 紫色: 表格单元":
    "Light blue: fixed text | Green: fillable value | Orange: header | Purple: table cell",
  "当前为 Mock OCR 坐标，仅用于流程演示，位置可能与真实模板不一致。":
    "Currently using mock OCR coordinates for demo only — positions may not match the real template.",
  "当前模板暂无坐标锚点，请重新上传更清晰或更完整的模板。":
    "No coordinate anchors detected for this template — please re-upload a clearer or more complete template.",
  "模板表格预览": "Template table preview",
  "模板质量": "Template quality",
  "合格": "Qualified",
  "不合格": "Not qualified",
  "公司信息": "Company info",
  "明细数据": "Detail data",
  "汇总信息": "Summary info",
  "添加行": "Add row",
  "暂无数据，点击\"添加行\"开始录入": "No data yet — click \"Add row\" to start entering data",
  "导出": "Export",
  "Excel 文件": "Excel file",
  "推荐，多工作表": "Recommended; multiple sheets",
  "CSV 文件": "CSV file",
  "通用表格格式": "Common spreadsheet format",
  "JSON 文件": "JSON file",
  "结构化数据": "Structured data",
  "编辑表单数据，完成后可导出下载": "Edit the form data; export and download when finished",
  "表格列": "Table columns",
  "下载文件": "Download file",
  "推荐": "Recommended",
  "Excel 格式，支持多工作表": "Excel format with multiple sheets",
  "结构化数据，便于程序处理": "Structured data for programmatic processing",
  "下载 Excel 文件": "Download Excel file",
  "下载 JSON 文件": "Download JSON file",

  // --- ResultView ---
  "核对有误！修改表单信息并核对": "Please review and correct any errors in the form",
  "点击表格单元格即可编辑，确认无误后请下载文件。":
    "Click a table cell to edit; download once the data is correct.",
  "返回重新上传": "Back to upload",
  "单据类型": "Document type",
  "供应商/客户": "Supplier / customer",
  "总金额": "Total amount",
  "单据": "Document",

  // --- exportUtils ---
  "财务表单": "Financial form",
  "序号": "No.",
  "字段": "Field",
  "值": "Value",
  "摘要信息": "Summary info",
  "总金额_key": "Total amount",
  "单据日期": "Document date",
  "联系电话": "Phone",
  "地址": "Address",
  "单据编号": "Document number",

  // --- API / kimi extras ---
  "缺少必要参数：fileBase64, mimeType, templateStructure":
    "Missing required parameters: fileBase64, mimeType, templateStructure",
  "模板质量不足，无法可靠提取。请重新创建模板并确保锚点覆盖率足够。":
    "Template quality is insufficient for reliable extraction. Please recreate the template and ensure anchor coverage is sufficient.",
  "模板与当前文档对齐失败，无法保证导出位置准确。":
    "The template could not be aligned with the current document; export positions may be inaccurate.",
  "数据提取失败，请重试": "Data extraction failed, please retry",

  // --- kimi.ts dynamic strings ---
  "不支持的文件类型: %s。仅支持 PDF 或图片。":
    "Unsupported file type: %s. Only PDF or images are supported.",
  "不支持的文件类型: %s。模板提取目前仅支持 PDF 或图片。":
    "Unsupported file type: %s. Template extraction currently supports only PDF or images.",
  "模板识别仅支持图片文件（JPG/PNG/WEBP），当前类型: %s":
    "Template recognition supports image files only (JPG/PNG/WEBP). Got type: %s",
  "模板识别当前仅支持图片（JPG/PNG/WEBP）。收到类型：%s":
    "Template recognition currently supports image files only (JPG/PNG/WEBP). Got type: %s",
  "OCR 服务不可用: %s": "OCR service unavailable: %s",
  "对齐失败：匹配锚点 %d，内点率 %s%，重投影误差 %spx。原因: %s":
    "Alignment failed: %d anchors matched, inlier ratio %s%, reprojection error %spx. Reason: %s",
  "对齐诊断": "Alignment diagnostics",
  "锚点": "Anchors",
  "内点率": "Inlier ratio",
  "重投影误差": "Reprojection error",

  // --- Kimi network error multi-line ---
  "无法连接到 Kimi API：当前运行环境的网络访问不到 api.moonshot.cn。\n请确认：\n1）检查网络连接是否正常；\n2）确认 API Key 是否有效；\n3）尝试稍后重试。":
    "Cannot reach the Kimi API: the current runtime cannot reach api.moonshot.cn.\nPlease check:\n1) network connectivity;\n2) that the API key is valid;\n3) retry in a moment.",

  // --- Document types (TemplateType labels) ---
  "送货单 (Delivery Note)": "Delivery Note",
  "对账单 (Reconciliation)": "Reconciliation Statement",
  "采购单 (Purchase Order)": "Purchase Order",
  "银行流水 (Bank Statement)": "Bank Statement",
  "支付清单 (Payment List)": "Payment List",
  "报价单 (Quotation)": "Quotation",

  // --- Backend errors (friendlyBackendError) ---
  "后端服务正在唤醒中（首次访问约 1 分钟），请稍候再试一次。":
    "Backend is waking up (first request takes ~1 minute). Please try again in a moment.",
  "登录已过期，请刷新页面重新登录。":
    "Session expired. Please refresh the page and log in again.",
  "文件太大，请压缩到 50 MB 以内再上传。":
    "File too large. Please compress to under 50 MB and try again.",
  "请求太频繁，请稍等几秒后再试。":
    "Too many requests. Please wait a few seconds and retry.",
  "后端调用失败": "Backend call failed",
  "PYTHON_BACKEND_URL 未配置，无法访问后端":
    "PYTHON_BACKEND_URL is not configured; cannot reach backend",

  // --- Middleware ---
  "未授权：请先登录": "Unauthorized: please log in first",
  "密码错误": "Wrong password",

  // --- API route errors ---
  "缺少必要参数：fileBase64, mimeType, templateType":
    "Missing required parameters: fileBase64, mimeType, templateType",
  "缺少必要参数：fileBase64, mimeType":
    "Missing required parameters: fileBase64, mimeType",
  "Python 后端处理失败": "Python backend processing failed",
  "AI 处理失败，请重试": "AI processing failed, please retry",
  "未配置 PYTHON_BACKEND_URL，智能转换需要 Python 后端支持":
    "PYTHON_BACKEND_URL is not configured; smart convert requires the Python backend",
  "转换失败": "Conversion failed",
  "模板识别失败，请重试": "Template recognition failed, please retry",
  "无法连接到 AI API，请检查网络连接后重试。":
    "Cannot reach the AI API — please check your network and retry.",

  // --- AI prompts (TEMPLATE_PROMPTS in kimi.ts) ---
  // These instruct the AI on what to extract and how to label fields.
  "delivery_note_prompt":
    `You are a financial-document extraction assistant. Extract the delivery-note information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["Date", "Item", "Spec", "Quantity", "Unit Price", "Amount", "Notes"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier (supplier/customer), documentType, documentNumber
Note: ignore stamps, seals, and signatures. Return only JSON.`,
  "reconciliation_prompt":
    `You are a financial-document extraction assistant. Extract the reconciliation-statement information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["Date", "Description", "Debit", "Credit", "Balance", "Notes"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier, documentType, documentNumber
Note: ignore stamps, seals, and signatures. Return only JSON.`,
  "purchase_order_prompt":
    `You are a financial-document extraction assistant. Extract the purchase-order information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["No.", "Item", "Model", "Unit", "Quantity", "Unit Price", "Amount"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier, documentType, documentNumber
Note: ignore stamps, seals, and signatures. Return only JSON.`,
  "bank_statement_prompt":
    `You are a financial-document extraction assistant. Extract the bank-statement/transaction information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["Transaction Date", "Type", "Counterparty Account", "Description", "Credit", "Debit", "Balance"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier, documentType, documentNumber
Note: ignore stamps, seals, and signatures. Return only JSON.`,
  "payment_list_prompt":
    `You are a financial-document extraction assistant. Extract the payment-list information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["No.", "Payee", "Account", "Amount", "Purpose", "Date", "Status"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier, documentType, documentNumber
Note: ignore stamps, seals, and signatures. Return only JSON.`,
  "quotation_prompt":
    `You are a financial-document extraction assistant. Extract the quotation information from the uploaded file and return it as JSON.
Extract these fields:
- headers: array of column headers, e.g. ["No.", "Spec", "Kg", "Qty/Kg", "Unit Price", "Amount", "Notes"]
- rows: array of row objects
- summary: object containing totalAmount, documentDate, supplier, documentType, documentNumber, contact, address
Note: ignore stamps, seals, signatures, and watermarks. Return only JSON.`,

  // --- Template structure recognition prompt (kimi.ts recognizeTemplateStructure) ---
  "template_structure_prompt":
    `You are a form-structure analyst. Analyze the uploaded document/form image and return its structure as JSON.

# Task
Identify the layout of this document/form and output these four groups:

1. **companyInfo.fields** — fields in the top company/contact info header. Each object is { key, label, type, required }:
   - key is a short English word (companyName, address, phone, fax, mobile, taxId, ...)
   - label is the English display name
   - type ∈ "text" | "number" | "date"
   - required is a boolean
2. **tableHeaders** — the column names of the middle detail table, left-to-right. e.g. "No.", "Spec", "Quantity", "Unit Price", "Amount", "Notes"
3. **tableFieldTypes** — array of the same length as tableHeaders, each ∈ "text" | "number" | "date"
4. **summaryFields** — summary/customer fields outside the table, e.g. "Delivery No.", "Customer", "Shipping Address", "Total Amount"

# Rules
- Only identify labels that actually appear in the template — do not invent fields
- "Customer info" goes in summaryFields; "our company info" (the header area) goes in companyInfo
- If headers are "No. Spec Quantity Unit Price Amount Notes", tableHeaders = ["No.","Spec","Quantity","Unit Price","Amount","Notes"], tableFieldTypes = ["number","text","number","number","number","text"]

# Output (return JSON only, no preamble)
{
  "companyInfo": { "fields": [ { "key":"...", "label":"...", "type":"text", "required":false } ] },
  "tableHeaders": [ "...", "..." ],
  "tableFieldTypes": [ "text", "number" ],
  "summaryFields": [ "...", "..." ]
}`,
};
