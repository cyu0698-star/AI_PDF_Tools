# 部署上线指南（发个网址给测试者用）

本项目是前端（Next.js）+ 后端（FastAPI）两个服务。下面用 **Render Blueprint**
一次把两个都部署好，测试者打开网址、输入密码即可使用。全程点网页，约 15 分钟。

---

## 第 0 步：先换新密钥（重要 ⚠️）

你的 Anthropic、OpenAI 密钥之前以明文出现在仓库里，应视为**已泄露**。上线前：

1. 到 [Anthropic 后台](https://console.anthropic.com/) 吊销旧 Key、生成新 Key。
2. 到 [OpenAI 后台](https://platform.openai.com/api-keys) 吊销旧 Key、生成新 Key。
3. 新 Key 只填到第 3 步的 Render 环境变量里，**不要写进任何文件**。

---

## 第 1 步：把代码传到 GitHub

以 `code/` 文件夹作为仓库根目录（`render.yaml` 必须在根目录），新建一个**私有**仓库推上去。

> 真实单据样本、测试截图、含密钥的本地脚本已被 `.gitignore` 排除，不会上传。

---

## 第 2 步：在 Render 创建 Blueprint

1. 注册 / 登录 [render.com](https://render.com)。
2. 点 **New → Blueprint**。
3. 选择刚才的 GitHub 仓库。Render 会自动读取 `render.yaml`，
   创建两个服务：`receiptsys-backend` 和 `receiptsys-frontend`。

---

## 第 3 步：填 3 个密钥

Render 会提示你填入这几个值（其余都已自动配置好）：

| 变量名 | 填什么 |
| --- | --- |
| `AI_API_KEY` | 你的新 Anthropic 密钥（`sk-ant-...`） |
| `OCR_OPENAI_API_KEY` | 你的新 OpenAI 密钥（`sk-proj-...`） |
| `APP_PASSWORD` | **你自己定的访问密码**，发给测试者 |

前端连后端的地址（`PYTHON_BACKEND_URL`）已通过 `render.yaml` 自动连好，无需手填。

---

## 第 4 步：等部署完成，分享网址

两个服务都变绿后，打开 `receiptsys-frontend` 的网址。
把这个 **网址 + 访问密码** 发给测试者即可。✅

---

## 说明

- **费用**：每次识别都消耗你的 Anthropic + OpenAI 额度。密码门可防止链接外泄被滥刷。
- **冷启动**：免费版服务闲置约 15 分钟后休眠，第一次打开要等约 30–60 秒，之后就快了。
  介意的话可把两个服务升级到付费档（约 $7/月/服务）保持常驻。
- **改密码**：在 Render 改 `receiptsys-frontend` 的 `APP_PASSWORD` 后重新部署即可。
- **本地运行**：复制 `backend/.env.example` → `backend/.env`、`frontend/.env.example` →
  `frontend/.env.local` 填好后，根目录 `docker compose up --build` 或 `./start.sh`。
  本地不设 `APP_PASSWORD` 时密码门自动关闭。
