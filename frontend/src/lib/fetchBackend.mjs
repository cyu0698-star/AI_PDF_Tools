// Cold-start-tolerant backend client.
//
// Render free instances spin down after ~15 min idle. The first request
// after a sleep takes 30–60 s to wake the container, then runs the actual
// work. If that combined time exceeds Render's edge timeout (~100 s) the
// request returns a 502 even though the backend itself was working.
//
// This helper handles that in two ways:
//   1. PRE-WARM: before the real request, fire a cheap GET /health. If the
//      backend is cold, /health wakes it; if it's warm, /health is fast.
//   2. RETRY: if the real request returns a 5xx or network error, sleep and
//      try once more. By then the backend is warm and the call fits in the
//      timeout window.
//
// Compatible with the existing backendBaseUrl() scheme-tolerance.

import { backendBaseUrl } from "./backendUrl.mjs";

const DEFAULT_WARMUP_TIMEOUT_MS = 60_000;   // long enough for a cold start
const DEFAULT_REQUEST_TIMEOUT_MS = 180_000; // long enough for slow AI calls
const DEFAULT_RETRIES = 1;                  // try twice total
const RETRY_DELAY_MS = 3_000;

let lastWarmAt = 0;
const WARM_CACHE_MS = 5 * 60_000; // skip pre-warm if we hit backend recently

async function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

/**
 * GET <backend>/health. Never throws — pre-warm is best-effort.
 * Skips the ping if we successfully reached the backend in the last
 * WARM_CACHE_MS, so we don't add a round-trip to every call in a busy session.
 */
export async function pingBackendHealth(timeoutMs = DEFAULT_WARMUP_TIMEOUT_MS) {
  const base = backendBaseUrl();
  if (!base) return;
  const now = Date.now();
  if (now - lastWarmAt < WARM_CACHE_MS) return;
  const { signal, clear } = await withTimeout(timeoutMs);
  try {
    const resp = await fetch(`${base}/health`, { signal });
    if (resp.ok) lastWarmAt = Date.now();
  } catch {
    // ignore — the real request will report any persistent failure
  } finally {
    clear();
  }
}

/**
 * fetchBackend(path, init, opts) — fetch against the configured backend with
 * pre-warm and one 5xx retry.
 *
 * - path: e.g. "/api/ai-vision"
 * - init: standard fetch init (method, headers, body, ...)
 * - opts.timeoutMs: per-attempt request timeout (default 180s)
 * - opts.retries: extra attempts beyond the first (default 1)
 * - opts.warmup: pre-warm before first attempt (default true)
 *
 * Throws on missing backend config or on exhausted retries.
 * Returns the (possibly non-2xx) Response if it got one — caller inspects status.
 */
export async function fetchBackend(path, init = {}, opts = {}) {
  const base = backendBaseUrl();
  if (!base) {
    throw new Error("PYTHON_BACKEND_URL 未配置，无法访问后端");
  }
  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    warmup = true,
  } = opts;

  if (warmup) await pingBackendHealth();

  const url = `${base}${path}`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, clear } = await withTimeout(timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal });
      // Render edge 5xx (502/503/504) is usually transient on free tier —
      // retry once after a short delay, the backend is warmer now.
      if (resp.status >= 502 && resp.status <= 504 && attempt < retries) {
        clear();
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      if (resp.ok) lastWarmAt = Date.now();
      return resp;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } finally {
      clear();
    }
  }
  throw lastErr || new Error("backend fetch failed after retries");
}

/**
 * Map raw error strings/statuses from the backend into Chinese messages the
 * tester can act on. Keep the original tail so engineers can still diagnose.
 */
export function friendlyBackendError(status, body) {
  const detail = String(body || "").slice(0, 200);
  if (status === 502 || status === 503 || status === 504) {
    return `后端服务正在唤醒中（首次访问约 1 分钟），请稍候再试一次。(${status})`;
  }
  if (status === 401) {
    return "登录已过期，请刷新页面重新登录。";
  }
  if (status === 413) {
    return "文件太大，请压缩到 50 MB 以内再上传。";
  }
  if (status === 429) {
    return "请求太频繁，请稍等几秒后再试。";
  }
  return `后端调用失败: ${status}${detail ? " - " + detail : ""}`;
}
