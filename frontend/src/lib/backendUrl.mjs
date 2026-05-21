// Single source of truth for the Python backend URL.
// Tolerates a value with or without a scheme (so a bare host from a host's
// service-reference, e.g. "receiptsys-backend.onrender.com", also works).
// Returns "" when PYTHON_BACKEND_URL is unset.
export function backendBaseUrl() {
  const raw = (process.env.PYTHON_BACKEND_URL || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}
