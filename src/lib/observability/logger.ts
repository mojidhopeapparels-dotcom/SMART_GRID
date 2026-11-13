/**
 * Structured observability logger with automatic credential/secret redaction.
 * Ensures API keys, session tokens, passwords, and query-string secrets never hit logs.
 */

export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY_RE =
  /(password|secret|token|apikey|api_key|authorization|cookie|smtp_pass|passphrase|private_key)/i;

export function redactSensitiveString(input: string): string {
  return input
    .replace(/([?&](?:key|api_key|token|secret)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._\-+/=]+/gi, "$1[REDACTED]")
    .replace(/(x-goog-api-key["':\s]+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]");
}

export function sanitizeLogContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[DEPTH_LIMIT]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeLogContext(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeLogContext(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function logEvent(
  level: LogLevel,
  event: string,
  context?: Record<string, unknown>
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: "smart-grid",
    event,
    ...(context ? { context: sanitizeLogContext(context) } : {}),
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}
