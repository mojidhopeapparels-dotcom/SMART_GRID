import test from "node:test";
import assert from "node:assert/strict";
import { getDb, resetDbForTests } from "../src/lib/db";
import { ensureSeeded, resetSeedStateForTests } from "../src/lib/db/seed";
import { isEmailDeliveryConfigured, validateEnvironment } from "../src/lib/config/env";
import { WORKBOOK_LIMITS } from "../src/lib/sheets/exportHelpers";
import { redactSensitiveString, sanitizeLogContext } from "../src/lib/observability/logger";
import { canPublishPublicCity, getRolePermissions } from "../src/lib/auth/rbac";
import { resolveClientIpFromHeaders } from "../src/lib/auth/guards";
import { sendPasswordResetEmail } from "../src/lib/email/mailer";
import {
  generateRecoveryCodeBatch,
  issueRecoveryCodesForUser,
  normalizeRecoveryCode,
  verifyAndConsumeRecoveryCode,
} from "../src/lib/auth/mfaRecovery";
import { retrievePermittedContext } from "../src/lib/ai/provider";
import {
  commitAiTurnAndUsage,
  releaseAiQuotaReservation,
  reserveAiQuotaSlot,
} from "../src/lib/ai/quota";

test("environment validation enforces strict production secret & demo rules without leaking secrets", () => {
  const prevEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      SMART_GRID_DEMO_MODE: "true",
      SMART_GRID_SESSION_SECRET: "replace-with-short",
      NEXT_PUBLIC_APP_URL: "http://smartgrid.local",
    });
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SMART_GRID_EMAIL_WEBHOOK_URL;
    delete process.env.SMART_GRID_SMTP_HOST;

    const bad = validateEnvironment();
    assert.equal(bad.valid, false);
    assert.equal(bad.isProduction, true);
    assert.ok(bad.errors.some((e) => e.includes("32 characters")));
    assert.ok(bad.errors.some((e) => e.includes("placeholder")));
    assert.ok(bad.errors.some((e) => e.includes("SMART_GRID_DEMO_MODE=true")));
    assert.equal(bad.integrations.aiProvider, "INTEGRATION_REQUIRED");
    assert.equal(bad.integrations.emailDelivery, "INTEGRATION_REQUIRED");

    process.env.SMART_GRID_DEMO_MODE = "false";
    process.env.SMART_GRID_SESSION_SECRET = "9c4f8a2b1d7e0f3a5b6c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a";
    process.env.NEXT_PUBLIC_APP_URL = "https://city.smartgrid.example";
    const good = validateEnvironment();
    assert.equal(good.valid, true);
    assert.equal(good.hstsEnabled, true);
    assert.equal(good.demoModeEnabled, false);
    assert.equal(JSON.stringify(good).includes("9c4f8a2b1d7e0f3a"), false);
  } finally {
    process.env = prevEnv;
  }
});

test("observability logger redacts API keys, Bearer tokens, and secret keys", () => {
  const raw = "https://generativelanguage.googleapis.com/v1beta/models/gemini?key=AIzaFakeSecret123 Bearer eyJhbGciOi";
  const redacted = redactSensitiveString(raw);
  assert.equal(redacted.includes("AIzaFakeSecret123"), false);
  assert.equal(redacted.includes("eyJhbGciOi"), false);
  assert.ok(redacted.includes("[REDACTED]"));

  const obj = sanitizeLogContext({
    status: 500,
    password: "SuperSecretPassword!",
    nested: { api_key: "secret-key", safeField: "division-05" },
  }) as Record<string, unknown>;
  assert.equal(obj.password, "[REDACTED]");
  assert.equal((obj.nested as Record<string, unknown>).api_key, "[REDACTED]");
  assert.equal((obj.nested as Record<string, unknown>).safeField, "division-05");
});

test("canPublishPublicCity restricts public showcase city creation to privileged publishers", () => {
  assert.equal(canPublishPublicCity(getRolePermissions("ORG_OWNER")), true);
  assert.equal(canPublishPublicCity(getRolePermissions("SUPER_ADMIN")), true);
  assert.equal(canPublishPublicCity(getRolePermissions("CITY_ADMIN")), true);
  assert.equal(canPublishPublicCity(getRolePermissions("DATA_ANALYST")), false);
  assert.equal(canPublishPublicCity(getRolePermissions("OPERATIONS_MANAGER")), false);
  assert.equal(canPublishPublicCity(getRolePermissions("VIEWER")), false);
});

test("resolveClientIpFromHeaders prevents X-Forwarded-For spoofing unless SMART_GRID_TRUST_PROXY=true", () => {
  const prevTrust = process.env.SMART_GRID_TRUST_PROXY;
  try {
    delete process.env.SMART_GRID_TRUST_PROXY;
    const spoofedHeaders = new Headers({
      "x-forwarded-for": "198.51.100.42, 10.0.0.1",
      "x-real-ip": "203.0.113.9",
    });
    assert.equal(resolveClientIpFromHeaders(spoofedHeaders), "direct-unproxied");

    process.env.SMART_GRID_TRUST_PROXY = "true";
    assert.equal(resolveClientIpFromHeaders(spoofedHeaders), "198.51.100.42");

    const invalidHeaders = new Headers({ "x-forwarded-for": "not-an-ip<script>" });
    assert.equal(resolveClientIpFromHeaders(invalidHeaders), "127.0.0.1");
  } finally {
    if (prevTrust === undefined) delete process.env.SMART_GRID_TRUST_PROXY;
    else process.env.SMART_GRID_TRUST_PROXY = prevTrust;
  }
});

test("mailer reports INTEGRATION_REQUIRED when unconfigured and delivers cleanly through registered test sink", async () => {
  const prevEnv = { ...process.env };
  const g = globalThis as unknown as { __SMART_GRID_EMAIL_SINK__?: unknown };
  const prevSink = g.__SMART_GRID_EMAIL_SINK__;
  try {
    delete process.env.SMART_GRID_EMAIL_WEBHOOK_URL;
    delete process.env.SMART_GRID_SMTP_HOST;
    delete g.__SMART_GRID_EMAIL_SINK__;

    const unconfigured = await sendPasswordResetEmail({
      toEmail: "operator@example.org",
      fullName: "Test Operator",
      resetUrl: "https://example.org/reset-password?token=abc",
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    });
    assert.equal(unconfigured.delivered, false);
    assert.equal(unconfigured.status, "INTEGRATION_REQUIRED");

    const captured: string[] = [];
    g.__SMART_GRID_EMAIL_SINK__ = (payload: { resetUrl: string }) => {
      captured.push(payload.resetUrl);
    };
    const delivered = await sendPasswordResetEmail({
      toEmail: "operator@example.org",
      fullName: "Test Operator",
      resetUrl: "https://example.org/reset-password?token=xyz",
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    });
    assert.equal(delivered.delivered, true);
    assert.equal(delivered.channel, "test_sink");
    assert.equal(captured[0], "https://example.org/reset-password?token=xyz");
  } finally {
    if (prevSink !== undefined) g.__SMART_GRID_EMAIL_SINK__ = prevSink;
    else delete g.__SMART_GRID_EMAIL_SINK__;
    process.env = prevEnv;
  }
});

test("Stage 5 DB hardening: MFA recovery codes single-use, AI alert city/division scoping, and atomic AI quota slots", () => {
  const prevDbPath = process.env.SMART_GRID_DB_PATH;
  const prevDemo = process.env.SMART_GRID_DEMO_MODE;
  process.env.SMART_GRID_DB_PATH = ":memory:";
  process.env.SMART_GRID_DEMO_MODE = "true";
  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();

  try {
    const db = getDb();

    // 1. Verify Migration 002 Stage 5 tables exist
    const tbls = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const needed of [
      "password_reset_tokens",
      "mfa_recovery_codes",
      "mfa_pending_enrollments",
      "ai_quota_reservations",
      "seed_metadata",
    ]) {
      assert.ok(tbls.includes(needed), `Missing migration 002 table: ${needed}`);
    }

    // 2. MFA backup recovery codes: format normalization + strict single-use burn
    const batch = generateRecoveryCodeBatch(8);
    assert.equal(batch.displayCodes.length, 8);
    assert.equal(normalizeRecoveryCode("ab12-cd34-ef56"), "AB12CD34EF56");

    const issued = issueRecoveryCodesForUser(db, "usr_demo_admin", 8);
    assert.equal(issued.length, 8);
    assert.equal(verifyAndConsumeRecoveryCode(db, "usr_demo_admin", issued[0]), true);
    assert.equal(verifyAndConsumeRecoveryCode(db, "usr_demo_admin", issued[0]), false, "Replay of consumed recovery code must fail");
    assert.equal(verifyAndConsumeRecoveryCode(db, "usr_partner_admin", issued[1]), false, "Cross-user recovery code must fail");

    // 3. AI alert context scoping by cityId and divisionCode
    db.prepare(
      `INSERT INTO alerts (id, organization_id, city_id, division_code, priority, status, title, message, data_status, created_at, updated_at)
       VALUES ('alt_scope_test', 'org_demo_global', 'city_tokyo', '07', 'HIGH', 'ACTIVE', 'Tokyo Grid Spike Only', 'Tokyo feeder load warning', 'SIMULATED', datetime('now'), datetime('now'))`
    ).run();

    const matchedCtx = retrievePermittedContext({
      organizationId: "org_demo_global",
      cityId: "city_tokyo",
      divisionCode: "07",
      query: "alerts",
    });
    assert.ok(matchedCtx.contextText.includes("Tokyo Grid Spike Only"));

    const otherCityCtx = retrievePermittedContext({
      organizationId: "org_demo_global",
      cityId: "city_london",
      divisionCode: "07",
      query: "alerts",
    });
    assert.equal(otherCityCtx.contextText.includes("Tokyo Grid Spike Only"), false);

    const otherDivCtx = retrievePermittedContext({
      organizationId: "org_demo_global",
      cityId: "city_tokyo",
      divisionCode: "05",
      query: "alerts",
    });
    assert.equal(otherDivCtx.contextText.includes("Tokyo Grid Spike Only"), false);

    const otherTenantCtx = retrievePermittedContext({
      organizationId: "org_partner_metro",
      cityId: "city_tokyo",
      divisionCode: "07",
      query: "alerts",
    });
    assert.equal(otherTenantCtx.contextText.includes("Tokyo Grid Spike Only"), false, "Tenant B must never receive Tenant A alerts");

    // 4. Atomic AI quota slot reservation + release on failure + commit on success
    db.prepare("UPDATE subscriptions SET ai_monthly_quota = 1 WHERE organization_id = 'org_partner_metro'").run();
    const res1 = reserveAiQuotaSlot({ organizationId: "org_partner_metro", userId: "usr_partner_admin" });
    assert.equal(res1.ok, true);
    if (res1.ok) {
      // Concurrent second slot must fail while slot 1 is RESERVED
      const resConcurrent = reserveAiQuotaSlot({ organizationId: "org_partner_metro", userId: "usr_partner_admin" });
      assert.equal(resConcurrent.ok, false);

      // Releasing slot 1 on provider error frees quota with zero usage_records created
      releaseAiQuotaReservation(res1.reservationId);
      const usageAfterRelease = db
        .prepare("SELECT COUNT(*) AS cnt FROM usage_records WHERE organization_id = 'org_partner_metro' AND metric_type = 'AI_REQUEST'")
        .get() as { cnt: number };
      assert.equal(usageAfterRelease.cnt, 0);

      // Reserve again and commit atomically
      const res2 = reserveAiQuotaSlot({ organizationId: "org_partner_metro", userId: "usr_partner_admin" });
      assert.equal(res2.ok, true);
      if (res2.ok) {
        commitAiTurnAndUsage({
          reservationId: res2.reservationId,
          organizationId: "org_partner_metro",
          userId: "usr_partner_admin",
          sessionId: "ais_test_01",
          isNewSession: true,
          cityId: null,
          divisionCode: null,
          prompt: "Check readiness",
          replyText: "Verified readiness.",
          provider: "gemini",
          model: "gemini-2.5-flash",
          citationsJson: "[]",
        });

        const resAfterQuota = reserveAiQuotaSlot({ organizationId: "org_partner_metro", userId: "usr_partner_admin" });
        assert.equal(resAfterQuota.ok, false, "Quota must be enforced after committed usage");
      }
    }
  } finally {
    resetDbForTests();
    resetSeedStateForTests();
    if (prevDbPath !== undefined) process.env.SMART_GRID_DB_PATH = prevDbPath;
    else delete process.env.SMART_GRID_DB_PATH;
    if (prevDemo !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemo;
    else delete process.env.SMART_GRID_DEMO_MODE;
  }
});

test("WORKBOOK_LIMITS caps sheets at 25 and isEmailDeliveryConfigured requires explicit SMTP or webhook config", () => {
  assert.equal(WORKBOOK_LIMITS.MAX_SHEETS, 25);
  assert.equal(WORKBOOK_LIMITS.MAX_CELLS, 10_000);
  const prevWebhook = process.env.SMART_GRID_EMAIL_WEBHOOK_URL;
  const prevSmtp = process.env.SMART_GRID_SMTP_HOST;
  try {
    delete process.env.SMART_GRID_EMAIL_WEBHOOK_URL;
    delete process.env.SMART_GRID_SMTP_HOST;
    assert.equal(isEmailDeliveryConfigured(), false);

    process.env.SMART_GRID_EMAIL_WEBHOOK_URL = "https://mail-relay.city.example/hook";
    assert.equal(isEmailDeliveryConfigured(), true);
  } finally {
    if (prevWebhook !== undefined) process.env.SMART_GRID_EMAIL_WEBHOOK_URL = prevWebhook;
    else delete process.env.SMART_GRID_EMAIL_WEBHOOK_URL;
    if (prevSmtp !== undefined) process.env.SMART_GRID_SMTP_HOST = prevSmtp;
    else delete process.env.SMART_GRID_SMTP_HOST;
  }
});
