#!/usr/bin/env bash
# 一键停止 AI_PDF_Tools。安全停 8000 + 3000 + 残留的 uvicorn / next-server。

stop_port() {
  local port="$1" name="$2"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null)"
  if [ -z "$pids" ]; then
    echo "[$name] :$port 没在跑"
  else
    echo "[$name] kill PIDs: $pids"
    kill $pids 2>/dev/null
    sleep 1
    # 还在的话 -9
    pids="$(lsof -ti:"$port" 2>/dev/null)"
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  fi
}

stop_port 8000 backend
stop_port 3000 frontend

# 兜底：清掉残留 next-server / uvicorn 进程
pkill -f "next-server" 2>/dev/null
pkill -f "uvicorn app.main" 2>/dev/null

echo "完成。"
