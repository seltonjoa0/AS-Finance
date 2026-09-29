export function safeRedirectPath(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  try {
    const parsed = new URL(value, "https://aflora.local");
    if (parsed.origin !== "https://aflora.local") return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
