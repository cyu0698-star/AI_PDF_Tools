import { backendBaseUrl } from "../../../lib/backendUrl.mjs";
import { pingBackendHealth } from "../../../lib/fetchBackend.mjs";

function normalizeToken(token) {
  if (!token || typeof token.text !== "string") return null;
  const text = token.text.trim();
  if (!text) return null;
  return {
    text,
    bbox: token.bbox || undefined,
  };
}

function normalizeTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.map(normalizeToken).filter(Boolean);
}

function readHttpProviderConfig() {
  // Fall back to the Python backend's /api/ocr when OCR_HTTP_URL is unset,
  // so a single PYTHON_BACKEND_URL wires up both AI and OCR.
  let url = (process.env.OCR_HTTP_URL || "").trim();
  if (!url) {
    const base = backendBaseUrl();
    if (base) url = `${base}/api/ocr`;
  }
  return {
    url,
    timeoutMs: Number(process.env.OCR_HTTP_TIMEOUT_MS || 10000),
    apiKey: (process.env.OCR_HTTP_API_KEY || "").trim(),
  };
}

function shrinkErrorText(raw) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function extractErrorDetail(text) {
  const compact = shrinkErrorText(text);
  if (!compact) return "";
  try {
    const parsed = JSON.parse(compact);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.detail === "string") return shrinkErrorText(parsed.detail);
      if (
        parsed.detail &&
        typeof parsed.detail === "object" &&
        typeof parsed.detail.message === "string"
      ) {
        return shrinkErrorText(parsed.detail.message);
      }
      if (typeof parsed.error === "string") return shrinkErrorText(parsed.error);
    }
  } catch {
    // Not JSON payload; keep text fragment.
  }
  return compact;
}

async function fetchOcrOnce(url, body, apiKey, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runHttpProvider({ fileBase64, mimeType, sourceType }) {
  const { url, timeoutMs, apiKey } = readHttpProviderConfig();
  if (!url) {
    return {
      provider: "http",
      tokens: [],
      warnings: ["ocr_http_url_missing"],
    };
  }

  // Pre-warm the backend (no-op if it's been hit recently).
  // Cold-start can be ~50 s on Render free tier; the real OCR call then
  // fits inside the request timeout without bumping Render's edge limit.
  await pingBackendHealth();

  const body = JSON.stringify({ fileBase64, mimeType, sourceType });

  // Try twice: first attempt may catch the tail of a cold start and hit
  // a 5xx / network error; second attempt finds the backend warm.
  const MAX_ATTEMPTS = 2;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchOcrOnce(url, body, apiKey, timeoutMs);

      const transient =
        response.status >= 502 && response.status <= 504 && attempt < MAX_ATTEMPTS;
      if (transient) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const detail = extractErrorDetail(errorText);
        return {
          provider: "http",
          tokens: [],
          warnings: [
            detail
              ? `ocr_http_non_200:${response.status}:${detail}`
              : `ocr_http_non_200:${response.status}`,
          ],
        };
      }

      const payload = await response.json();
      const tokens = normalizeTokens(
        payload?.tokens || payload?.data?.tokens || payload?.result?.tokens
      );

      if (tokens.length === 0) {
        return {
          provider: "http",
          tokens: [],
          warnings: ["ocr_http_empty_tokens"],
        };
      }

      return {
        provider: "http",
        tokens,
        warnings: ["ocr_http_tokens_used"],
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    }
  }

  const reason =
    lastError instanceof Error && lastError.name === "AbortError"
      ? "timeout"
      : "request_failed";
  const msg =
    lastError instanceof Error && lastError.message
      ? `:${shrinkErrorText(lastError.message)}`
      : "";
  return {
    provider: "http",
    tokens: [],
    warnings: [`ocr_http_${reason}${msg}`],
  };
}

/**
 * @param {{
 *   fileBase64?: string,
 *   mimeType?: string,
 *   sourceType?: string,
 *   clientTokens?: Array<{text: string, bbox?: {x:number,y:number,w:number,h:number}}>
 * }} input
 */
export async function getOcrTokens({
  fileBase64,
  mimeType,
  sourceType,
  clientTokens = undefined,
} = {}) {
  void fileBase64;
  void mimeType;
  void sourceType;

  const normalizedClient = normalizeTokens(clientTokens);
  if (normalizedClient.length > 0) {
    return {
      provider: "client",
      tokens: normalizedClient,
      warnings: ["ocr_client_tokens_used"],
    };
  }

  const provider = (process.env.OCR_PROVIDER || "http").toLowerCase();
  switch (provider) {
    case "http": {
      const httpResult = await runHttpProvider({ fileBase64, mimeType, sourceType });
      return httpResult;
    }
    default:
      return {
        provider: provider || "unknown",
        tokens: [],
        warnings: [`ocr_provider_unsupported:${provider || "unknown"}`],
      };
  }
}
