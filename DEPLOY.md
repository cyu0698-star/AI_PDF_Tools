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

## 第 5 步（强烈建议）：配 UptimeRobot 防冷启动

Render 免费档闲置 15 分钟就睡，第一个测试者上来要等近 1 分钟才能跑通。
配一个免费的 UptimeRobot 监控每 5 分钟戳一下两个服务，让它们根本不睡：

1. 去 [uptimerobot.com](https://uptimerobot.com) 注册免费账号（用 Google 一键最快）。
2. New monitor → HTTP/website → URL 填：
   - `https://receiptsys-backend.onrender.com/health`
   - `https://receiptsys-frontend.onrender.com`
3. 间隔 5 分钟（免费档默认值），保存。

两个 monitor 都建好之后，理论上后端永远是热的，测试者打开就用。

---

## 说明

- **费用**：每次识别都消耗你的 Anthropic + OpenAI 额度。密码门可防止链接外泄被滥刷。
- **改密码**：在 Render 改 `receiptsys-frontend` 的 `APP_PASSWORD` 后重新部署即可。
- **本地运行**：复制 `backend/.env.example` → `backend/.env`、`frontend/.env.example` →
  `frontend/.env.local` 填好后，根目录 `docker compose up --build` 或 `./start.sh`。
  本地不设 `APP_PASSWORD` 时密码门自动关闭。

---

## 故障排查 ＆ 已知卡点全景图

部署过程踩过的坑，全部记下来，下次再撞或新人接手能直接照着查。

### 三层防御：冷启动 + 长 AI 调用

Render 免费档有两个互相叠加的限制：服务闲置 15 分钟会休眠（冷启动 30–60 秒），
单次 HTTP 请求超过 ~100 秒边缘会切（502）。冷启动 + 一次复杂的 Claude vision
调用很容易超过这个窗口。三层防御：

| 层 | 做什么 | 在哪里 | 状态 |
| --- | --- | --- | --- |
| 1 | 调后端前先 GET `/health` 预热（5 分钟内的重复调用跳过），5xx 自动重试一次 | `frontend/src/lib/fetchBackend.mjs` | 代码层，已上线 |
| 2 | UptimeRobot 每 5 分钟 ping 两个服务，根本不让它们睡 | UptimeRobot 控制台 | 见第 5 步 |
| 3 | 升级 Render Starter（$7/月/服务 × 2 = $14/月），关闭自动休眠 | Render dashboard | 可选，治本 |

### 常见错误信息含义

| 错误信息 | 真实原因 | 解决 |
| --- | --- | --- |
| `后端服务正在唤醒中（首次访问约 1 分钟）` | Render 边缘 502（冷启动 + 长调用超时） | 等 1 分钟再试；或配 UptimeRobot |
| `fetch failed` / `ENOTFOUND receiptsys-backend` | `PYTHON_BACKEND_URL` 用了内部短名而非 `.onrender.com` 完整域名 | 已修复：`render.yaml` 写死完整 URL，不用 `fromService property: host` |
| `ocr_http_request_failed:fetch failed` | OCR 超时太短（默认 10s）撞冷启动 | 已修复：`render.yaml` 里设 `OCR_HTTP_TIMEOUT_MS=180000` |
| `登录已过期，请刷新页面重新登录` | Cookie 过期或 `APP_PASSWORD` 改了 | 刷新页面重新输密码 |
| `文件太大，请压缩到 50 MB 以内再上传` | Render 入站请求体超限 | 压缩 PDF / 截图 |

### 改 render.yaml 的注意事项

- **不要用 `fromService property: host` 来传后端地址给前端** —— 它返回的是
  Render 内部短名（如 `receiptsys-backend`），只在 Render 私有网络可解析，
  免费档跨服务调用走公网会 ENOTFOUND。**直接写死完整 `.onrender.com` URL**。
- 后端依赖中已**剔除 Paddle/OpenCV** 这堆几 GB 的库（`OCR_ENGINE=openai` 用不到），
  Render 构建只需 1–2 分钟。本地想用 Paddle 再装 `requirements-paddle.txt`。
- API 密钥用 `sync: false` —— Render 部署时提示填，**不在 git 里**。

### 安全检查清单（每次重大改动前）

- [ ] `grep -rE "sk-[A-Za-z0-9_-]{16,}"` 仓库根目录，确认没新增的硬编码密钥。
- [ ] `git status --ignored` 看一眼真实样本、`.env`、本地脚本都还在被忽略。
- [ ] Anthropic / OpenAI 后台查上次轮换日期；3 个月内轮换一次更稳。

### 排查流程（线上报错怎么定位）

1. **看 Render Events**：前端服务 → Events，看最近一次 Deploy 是否 live。
2. **看 Render Logs**：前端服务 → Logs，搜「error」或路径名（如「ocr」）。
   报错栈通常直接指出根因（`ENOTFOUND` / `ECONNREFUSED` / `fetch failed` 等）。
3. **curl 后端验证**：`curl -i https://receiptsys-backend.onrender.com/health` —— 如果它正常，
   问题在前端→后端的连接配置；如果它本身报错，问题在后端环境变量或代码。
4. **看 UptimeRobot 历史**：能看到过去 24 小时哪几次 down，配合 Render Events
   能锁定是冷启动撞窗口还是真的服务挂了。
