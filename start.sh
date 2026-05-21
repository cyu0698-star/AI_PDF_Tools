#!/usr/bin/env bash
# 一键启动 AI_PDF_Tools — backend (uvicorn :8000) + frontend (next dev :3000)
# 进程完全脱离当前 shell（被 launchd 收养），关终端 / 注销 / shell 退出不会停。
# 重启电脑会停（macOS launchd 不持久化），开机后再跑一次本脚本即可。

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
UVICORN="/Library/Frameworks/Python.framework/Versions/3.11/bin/uvicorn"
BACKEND_LOG="/tmp/ai_pdf_backend.log"
FRONTEND_LOG="/tmp/ai_pdf_frontend.log"

c_green() { printf "\033[32m%s\033[0m\n" "$*"; }
c_yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
c_red() { printf "\033[31m%s\033[0m\n" "$*"; }

is_listening() {
  lsof -ti:"$1" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1" timeout="${2:-30}" i=0
  while [ "$i" -lt "$timeout" ]; do
    is_listening "$port" && return 0
    sleep 1
    i=$((i + 1))
  done
  return 1
}

start_backend() {
  if is_listening 8000; then
    c_yellow "[backend] 已在 :8000 运行，跳过。PID: $(lsof -ti:8000)"
    return
  fi
  if [ ! -x "$UVICORN" ]; then
    c_red "[backend] uvicorn 不存在: $UVICORN"
    c_red "请先用 pip install uvicorn fastapi httpx pydantic python-dotenv openpyxl 装依赖"
    return 1
  fi
  cd "$BACKEND_DIR" || return 1
  nohup "$UVICORN" app.main:app --host 127.0.0.1 --port 8000 \
    < /dev/null > "$BACKEND_LOG" 2>&1 &
  disown
  cd "$ROOT" || true
  if wait_for_port 8000 30; then
    c_green "[backend] 已启动 :8000 PID=$(lsof -ti:8000) 日志=$BACKEND_LOG"
  else
    c_red "[backend] 启动超时，看日志: tail -50 $BACKEND_LOG"
    return 1
  fi
}

start_frontend() {
  if is_listening 3000; then
    c_yellow "[frontend] 已在 :3000 运行，跳过。PID: $(lsof -ti:3000)"
    return
  fi
  if ! command -v npm >/dev/null 2>&1; then
    c_red "[frontend] npm 没装。先 brew install node 或装个 nodejs。"
    return 1
  fi
  cd "$FRONTEND_DIR" || return 1
  nohup npm run dev < /dev/null > "$FRONTEND_LOG" 2>&1 &
  disown
  cd "$ROOT" || true
  if wait_for_port 3000 60; then
    c_green "[frontend] 已启动 :3000 PID=$(lsof -ti:3000) 日志=$FRONTEND_LOG"
  else
    c_red "[frontend] 启动超时，看日志: tail -50 $FRONTEND_LOG"
    return 1
  fi
}

echo "================================================"
echo "  AI_PDF_Tools 启动中..."
echo "================================================"
start_backend || exit 1
start_frontend || exit 1
echo ""
c_green "✓ 全部启动完成"
echo ""
echo "  浏览器打开:  http://localhost:3000/dashboard"
echo "  停止服务:    $ROOT/stop.sh"
echo "  看 backend 日志:  tail -f $BACKEND_LOG"
echo "  看 frontend 日志: tail -f $FRONTEND_LOG"
