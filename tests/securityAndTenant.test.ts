import test from "node:test";
import assert from "node:assert/strict";
import { getDb, resetDbForTests } from "../src/lib/db";
import { ensureSeeded, resetSeedStateForTests } from "../src/lib/db/seed";
import { hashPassword, sha256Hex, verifyPassword } from "../src/lib/auth/password";
import { buildTotpUri, generateTotpCode, generateTotpSecret, verifyTotpCode } from "../src/lib/auth/totp";
import { getRolePermissions, hasPermission, SYSTEM_ROLES } from "../src/lib/auth/rbac";
import { checkRateLimit, _resetRateLimitsForTesting, _getRateLimitBucketCountForTesting } from "../src/lib/auth/rateLimit";
import { DIVISIONS } from "../src/lib/domain/divisions";
import { DATA_STATUS_META } from "../src/lib/domain/statuses";
import { getAiProviderStatus, invokeConfiguredAiProvider, retrievePermittedContext } from "../src/lib/ai/provider";

test("password hashing uses per-user salt and constant-time verification", () => {
  const h1 = hashPassword("SmartGrid#Test2026");
  const h2 = hashPassword("SmartGrid#Test2026");
  assert.notEqual(h1, h2);
  assert.equal(verifyPassword("SmartGrid#Test2026", h1), true);
  assert.equal(verifyPassword("WrongPassword", h1), false);
  assert.equal(sha256Hex("abc").length, 64);
});

test("TOTP secret generation, URI building, and verification work accurately", () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 16);
  const uri = buildTotpUri("operator@smartgrid.demo", secret);
  assert.ok(uri.startsWith("otpauth://totp/SMART%20GRID:operator%40smartgrid.demo"));
  const code = generateTotpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code), true);
  assert.equal(verifyTotpCode(secret, "000000"), code === "000000");
});

test("RBAC enforces distinct privileges between ADMIN, ANALYST, and VIEWER", () => {
  assert.ok(SYSTEM_ROLES.length >= 7);
  const adminPerms = getRolePermissions("ORG_OWNER");
  const analystPerms = getRolePermissions("DATA_ANALYST");
  const viewerPerms = getRolePermissions("VIEWER");

  assert.equal(hasPermission(adminPerms, "billing:manage"), true);
  assert.equal(hasPermission(adminPerms, "users:manage"), true);
  assert.equal(hasPermission(analystPerms, "sheets:write"), true);
  assert.equal(hasPermission(analystPerms, "users:manage"), false);
  assert.equal(hasPermission(viewerPerms, "sheets:read"), true);
  assert.equal(hasPermission(viewerPerms, "sheets:write"), false);
  assert.equal(hasPermission(viewerPerms, "operations:write"), false);
});

test("domain catalogs cover all 24 divisions and truthful statuses", () => {
  assert.equal(DIVISIONS.length, 24);
  assert.equal(DIVISIONS[0].code, "01");
  assert.equal(DIVISIONS[23].code, "24");
  assert.ok(DATA_STATUS_META.LIVE);
  assert.ok(DATA_STATUS_META.HISTORICAL);
  assert.ok(DATA_STATUS_META.SIMULATED);
  assert.ok(DATA_STATUS_META.INTEGRATION_REQUIRED);
  assert.ok(DATA_STATUS_META.UNAVAILABLE);
});

test("migrations, seeding, multi-tenant isolation, and truthful AI fallback behave deterministically", async () => {
  const prevDbPath = process.env.SMART_GRID_DB_PATH;
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevOpenai = process.env.OPENAI_API_KEY;

  process.env.SMART_GRID_DB_PATH = ":memory:";
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();
  // Verify idempotency on second call
  ensureSeeded();

  const db = getDb();
  const divCount = (db.prepare("SELECT COUNT(*) AS cnt FROM divisions").get() as { cnt: number }).cnt;
  assert.equal(divCount, 24);

  const demoWorkbooks = db.prepare("SELECT * FROM workbooks WHERE organization_id = ?").all("org_demo_global");
  const partnerWorkbooks = db.prepare("SELECT * FROM workbooks WHERE organization_id = ?").all("org_partner_metro");
  assert.ok(demoWorkbooks.length >= 1);
  assert.equal(partnerWorkbooks.length, 0);

  // AI retrieval scoped strictly to tenant must isolate ds_toronto_flood (org_partner_metro) from org_demo_global
  const partnerAiContext = retrievePermittedContext({ organizationId: "org_partner_metro", query: "floodplain" });
  const demoAiContext = retrievePermittedContext({ organizationId: "org_demo_global", query: "grid load" });
  const demoIds = new Set(demoAiContext.citations.map((c) => c.id));
  const partnerIds = new Set(partnerAiContext.citations.map((c) => c.id));
  assert.ok(demoAiContext.citations.length > 0);
  assert.equal(demoIds.has("ds_toronto_flood"), false);
  assert.equal(partnerIds.has("ds_toronto_flood"), true);
  assert.equal(partnerIds.has("ds_dhaka_aq"), false);

  // Without API keys, AI must return 503 AI_PROVIDER_UNAVAILABLE instead of fabricating output
  const status = getAiProviderStatus();
  assert.equal(status.configured, false);
  const aiReply = await invokeConfiguredAiProvider({
    systemInstruction: "Assist operator",
    userPrompt: "Summarize grid load",
    untrustedDataContext: demoAiContext.contextText,
  });
  assert.equal(aiReply.ok, false);
  if (!aiReply.ok) {
    assert.equal(aiReply.code, "AI_PROVIDER_UNAVAILABLE");
    assert.equal(aiReply.status, 503);
  }

  resetDbForTests();
  resetSeedStateForTests();
  if (prevDbPath !== undefined) process.env.SMART_GRID_DB_PATH = prevDbPath;
  else delete process.env.SMART_GRID_DB_PATH;
  if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
  if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
});

test("in-memory rate limiter caps active buckets and correctly limits rate", () => {
  _resetRateLimitsForTesting();

  // Allowed within limit
  const r1 = checkRateLimit("ip:test1", 3, 60_000);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = checkRateLimit("ip:test1", 3, 60_000);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = checkRateLimit("ip:test1", 3, 60_000);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // Exceeded
  const r4 = checkRateLimit("ip:test1", 3, 60_000);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);

  // Different key gets its own bucket
  const other = checkRateLimit("ip:test2", 3, 60_000);
  assert.equal(other.allowed, true);

  assert.ok(_getRateLimitBucketCountForTesting() >= 2);
  _resetRateLimitsForTesting();
  assert.equal(_getRateLimitBucketCountForTesting(), 0);
});

test("production seed security guard prevents auto-seeding demo users unless explicitly requested", () => {
  const prevDbPath = process.env.SMART_GRID_DB_PATH;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDemoMode = process.env.SMART_GRID_DEMO_MODE;
  const prevAdminEmail = process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL;
  const prevAdminPass = process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD;

  process.env.SMART_GRID_DB_PATH = ":memory:";
  const envMap = process.env as Record<string, string | undefined>;
  envMap.NODE_ENV = "production";
  delete envMap.SMART_GRID_DEMO_MODE;
  process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL = "sysadmin@secure-city.gov";
  process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD = "Bootstrap#ProductionPassword987!";

  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();

  const db = getDb();
  // Demo users must NOT exist
  const demoAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@smartgrid.local'").get();
  assert.equal(demoAdmin, undefined);

  // Bootstrap admin user MUST exist
  const bootstrapAdmin = db.prepare("SELECT id, email FROM users WHERE email = 'sysadmin@secure-city.gov'").get() as { id: string; email: string };
  assert.ok(bootstrapAdmin);
  assert.equal(bootstrapAdmin.email, "sysadmin@secure-city.gov");

  // Restore env
  resetDbForTests();
  resetSeedStateForTests();
  if (prevDbPath !== undefined) process.env.SMART_GRID_DB_PATH = prevDbPath;
  else delete process.env.SMART_GRID_DB_PATH;
  if (prevNodeEnv !== undefined) envMap.NODE_ENV = prevNodeEnv;
  else delete envMap.NODE_ENV;
  if (prevDemoMode !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemoMode;
  else delete process.env.SMART_GRID_DEMO_MODE;
  if (prevAdminEmail !== undefined) process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL = prevAdminEmail;
  else delete process.env.SMART_GRID_BOOTSTRAP_ADMIN_EMAIL;
  if (prevAdminPass !== undefined) process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD = prevAdminPass;
  else delete process.env.SMART_GRID_BOOTSTRAP_ADMIN_PASSWORD;
});
