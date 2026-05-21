export async function parseJsonSafely(response: Response): Promise<{
  data: unknown;
  text: string;
  isJson: boolean;
}> {
  const text = await response.text();
  try {
    return {
      data: JSON.parse(text),
      text,
      isJson: true,
    };
  } catch {
    return {
      data: null,
      text,
      isJson: false,
    };
  }
}

export function buildNonJsonApiError(response: Response, text: string): string {
  const contentType = response.headers.get("content-type") || "unknown";
  const brief = text.replace(/\s+/g, " ").slice(0, 120);
  return `接口返回非 JSON（status=${response.status}, content-type=${contentType}）: ${brief || "empty response"}`;
}
