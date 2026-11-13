/**
 * Centralized environment & runtime configuration posture validation for SMART GRID.
 * Never exposes secret values in validation output or client payloads.
 */

export interface EnvironmentValidationReport {
  nodeEnv: string;
  isProduction: boolean;
  demoModeEnabled: boolean;
  trustedProxyEnabled: boolean;
  hstsEnabled: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  integrations: {
    aiProvider: "gemini" | "openai-compatible" | "INTEGRATION_REQUIRED";
    emailDelivery: "smtp_or_webhook_configured" | "INTEGRATION_REQUIRED";
    databaseTarget: "memory" | "custom_path" | "default_path";
  };
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDemoModeEnabled(): boolean {
  return isProductionEnv()
    ? process.env.SMART_GRID_DEMO_MODE === "true"
    : process.env.SMART_GRID_DEMO_MODE !== "false";
}

export function isTrustedProxyEnabled(): boolean {
  return process.env.SMART_GRID_TRUST_PROXY?.trim().toLowerCase() === "true";
}

export function isHstsConfigured(): boolean {
  if (!isProductionEnv()) return false;
  if (process.env.SMART_GRID_ENABLE_HSTS?.trim().toLowerCase() === "true") {
    return true;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().toLowerCase() || "";
  return appUrl.startsWith("https://");
}

export function isEmailDeliveryConfigured(): boolean {
  const smtpHost = process.env.SMART_GRID_SMTP_HOST?.trim();
  const webhook = process.env.SMART_GRID_EMAIL_WEBHOOK_URL?.trim();
  return Boolean(webhook || smtpHost);
}

export function validateEnvironment(): EnvironmentValidationReport {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const sessionSecret = process.env.SMART_GRID_SESSION_SECRET?.trim() || "";
  if (isProd) {
    if (!sessionSecret) {
      errors.push("SMART_GRID_SESSION_SECRET must be set in production.");
    } else if (sessionSecret.length < 32) {
      errors.push("SMART_GRID_SESSION_SECRET must be at least 32 characters.");
    }
    if (/change-me|replace-with|example|placeholder/i.test(sessionSecret)) {
      errors.push("SMART_GRID_SESSION_SECRET contains an insecure placeholder value.");
    }
    if (process.env.SMART_GRID_DEMO_MODE === "true") {
      errors.push("SMART_GRID_DEMO_MODE=true is unsafe for public production deployments.");
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
    if (!appUrl) {
      warnings.push("NEXT_PUBLIC_APP_URL is unset; password reset links fallback cleanly only when configured.");
    } else if (!appUrl.startsWith("https://")) {
      warnings.push("NEXT_PUBLIC_APP_URL does not use https://; enable TLS & HSTS before external go-live.");
    }
  } else if (sessionSecret && sessionSecret.length < 32) {
    warnings.push("SMART_GRID_SESSION_SECRET is shorter than recommended 32 characters.");
  }

  const aiProvider: "gemini" | "openai-compatible" | "INTEGRATION_REQUIRED" =
    process.env.GEMINI_API_KEY?.trim()
      ? "gemini"
      : process.env.OPENAI_API_KEY?.trim()
        ? "openai-compatible"
        : "INTEGRATION_REQUIRED";

  if (aiProvider === "INTEGRATION_REQUIRED") {
    warnings.push("AI provider key missing (GEMINI_API_KEY / OPENAI_API_KEY); AI routes operate in 503 INTEGRATION_REQUIRED mode.");
  }
  if (!isEmailDeliveryConfigured()) {
    warnings.push("External email delivery unconfigured (SMART_GRID_EMAIL_WEBHOOK_URL / SMART_GRID_SMTP_HOST); password reset requires mail transport setup before GA.");
  }

  const dbPathRaw = process.env.SMART_GRID_DB_PATH?.trim() || "";
  const databaseTarget: "memory" | "custom_path" | "default_path" =
    dbPathRaw === ":memory:" ? "memory" : dbPathRaw ? "custom_path" : "default_path";

  return {
    nodeEnv,
    isProduction: isProd,
    demoModeEnabled: isDemoModeEnabled(),
    trustedProxyEnabled: isTrustedProxyEnabled(),
    hstsEnabled: isHstsConfigured(),
    valid: errors.length === 0,
    errors,
    warnings,
    integrations: {
      aiProvider,
      emailDelivery: isEmailDeliveryConfigured()
        ? "smtp_or_webhook_configured"
        : "INTEGRATION_REQUIRED",
      databaseTarget,
    },
  };
}
