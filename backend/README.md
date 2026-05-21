# Python 后端 - 财务文件识别

使用 Google Gemini API 处理财务文件的 Python 后端服务。

## 目录结构

- `app/main.py`: 应用入口（装配）
- `app/api/routes/`: 路由层
- `app/services/`: 业务服务层
- `app/schemas/`: Pydantic 数据模型
- `app/core/`: 配置与提示词

## 安装

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 配置

创建 `.env` 文件：

```env
# Google Gemini API 密钥
GEMINI_API_KEY=your_api_key_here

# 代理设置 (国内网络需要)
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

## 运行

### 测试 API 连接

```bash
python tests/test_api.py
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 配置前端使用 Python 后端

在 `frontend/.env.local` 中添加：

```env
PYTHON_BACKEND_URL=http://localhost:8000
```

## API 接口

### POST /api/process

处理财务文件。

请求体：
```json
{
  "fileBase64": "base64编码的文件内容",
  "mimeType": "image/png",
  "templateType": "delivery_note"
}
```

支持的模板类型：
- `delivery_note` - 送货单
- `reconciliation` - 对账单
- `purchase_order` - 采购单
- `bank_statement` - 银行流水
- `payment_list` - 支付清单

### POST /api/test

测试 Gemini API 连接。
