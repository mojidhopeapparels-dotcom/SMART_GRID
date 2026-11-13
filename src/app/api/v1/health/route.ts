import { getDb, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { apiSuccess } from "@/lib/domain/statuses";
import {
  isDemoModeEnabled,
  isEmailDeliveryConfigured,
  isHstsConfigured,
  isTrustedProxyEnabled,
  validateEnvironment,
} from "@/lib/config/env";

export async function GET() {
  ensureSeeded();
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS divCount FROM divisions").get() as {
    divCount: number;
  };
  const migrations = normalizeRows<{ version: string; applied_at: string }>(
    db.prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version ASC").all()
  );
  const envCheck = validateEnvironment();
  const aiConfigured = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );

  return apiSuccess({
    service: "SMART GRID",
    status: "OPERATIONAL",
    database: {
      status: "CONNECTED",
      engine: "sqlite",
      divisionsLoaded: row.divCount,
      migrationsApplied: migrations.length,
      latestMigration: migrations[migrations.length - 1]?.version ?? null,
    },
    aiProvider: {
      status: aiConfigured ? "CONFIGURED" : "INTEGRATION_REQUIRED",
      provider: process.env.GEMINI_API_KEY?.trim()
        ? "gemini"
        : process.env.OPENAI_API_KEY?.trim()
          ? "openai-compatible"
          : null,
    },
    readiness: {
      emailDelivery: isEmailDeliveryConfigured() ? "CONFIGURED" : "INTEGRATION_REQUIRED",
      demoModeEnabled: isDemoModeEnabled(),
      trustedProxyEnabled: isTrustedProxyEnabled(),
      hstsConfigured: isHstsConfigured(),
      configValid: envCheck.valid,
      configErrorCount: envCheck.errors.length,
      configWarningCount: envCheck.warnings.length,
    },
    checkedAt: new Date().toISOString(),
  });
}
