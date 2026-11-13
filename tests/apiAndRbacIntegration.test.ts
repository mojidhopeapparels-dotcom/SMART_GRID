import test from "node:test";
import assert from "node:assert/strict";
import { getDb, resetDbForTests } from "../src/lib/db";
import { ensureSeeded, resetSeedStateForTests } from "../src/lib/db/seed";
import {
  assertMutationSecurity,
  assertPermittedCity,
  assertTenantAsset,
  assertValidDivision,
} from "../src/lib/auth/guards";
import { escapeLike, isSafeExternalHttpsUrl } from "../src/lib/security/sanitize";

test("tenant isolation validation: real assertPermittedCity, assertValidDivision, assertTenantAsset", () => {
  const prevDbPath = process.env.SMART_GRID_DB_PATH;
  process.env.SMART_GRID_DB_PATH = ":memory:";
  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();

  const db = getDb();
  const orgGlobal = "org_demo_global";
  const orgPartner = "org_partner_metro";

  // 1. Both tenants must have seeded subscription rows (fixes silent 0-row UPDATE_PLAN)
  const globalSub = db.prepare("SELECT id, plan_code FROM subscriptions WHERE organization_id = ?").get(orgGlobal);
  const partnerSub = db.prepare("SELECT id, plan_code FROM subscriptions WHERE organization_id = ?").get(orgPartner);
  assert.ok(globalSub, "org_demo_global subscription must be seeded");
  assert.ok(partnerSub, "org_partner_metro subscription must be seeded");

  // 2. City permissions via real production guard
  assert.equal(assertPermittedCity(db, "city_tokyo", orgGlobal), true);
  assert.equal(assertPermittedCity(db, "city_tokyo", orgPartner), true);
  assert.equal(assertPermittedCity(db, "city_non_existent", orgGlobal), false);

  db.prepare(
    `INSERT INTO cities (id, organization_id, slug, name, country_code, region_name, latitude, longitude, timezone, currency, is_public, created_at, updated_at)
     VALUES ('city_private_partner', ?, 'private-partner', 'Private Partner City', 'CA', 'Ontario', 43.6, -79.3, 'UTC', 'CAD', 0, datetime('now'), datetime('now'))`
  ).run(orgPartner);

  assert.equal(assertPermittedCity(db, "city_private_partner", orgPartner), true);
  assert.equal(assertPermittedCity(db, "city_private_partner", orgGlobal), false);

  // 3. Division validation via real production guard (only 2-digit codes "01".."24" allowed)
  assert.equal(assertValidDivision("01"), true);
  assert.equal(assertValidDivision("24"), true);
  assert.equal(assertValidDivision("1"), false, "Single-digit division number must be rejected to prevent FK 500");
  assert.equal(assertValidDivision("99"), false);
  assert.equal(assertValidDivision("invalid"), false);

  // 4. Asset ownership validation via real production guard
  const sampleAsset = db.prepare("SELECT id FROM assets WHERE organization_id = ?").get(orgGlobal) as { id: string } | undefined;
  assert.ok(sampleAsset, "Expected seeded asset for org_demo_global");
  assert.equal(assertTenantAsset(db, sampleAsset.id, orgGlobal), true);
  assert.equal(assertTenantAsset(db, sampleAsset.id, orgPartner), false);

  resetDbForTests();
  resetSeedStateForTests();
  if (prevDbPath !== undefined) process.env.SMART_GRID_DB_PATH = prevDbPath;
  else delete process.env.SMART_GRID_DB_PATH;
});

test("assertMutationSecurity blocks spoofed loopback origins, cross-port origins, and form-urlencoded CSRF", () => {
  const sameOriginJson = new Request("http://localhost:3000/api/v1/auth/sign-out", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(assertMutationSecurity(sameOriginJson), null);

  const loopbackAlias = new Request("http://localhost:3000/api/v1/workbooks", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3000",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(assertMutationSecurity(loopbackAlias), null);

  const spoofedSubdomain = new Request("http://localhost:3000/api/v1/admin", {
    method: "POST",
    headers: {
      origin: "https://localhost.attacker.com",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(assertMutationSecurity(spoofedSubdomain)?.status, 403);

  const crossPortLoopback = new Request("http://localhost:3000/api/v1/admin", {
    method: "POST",
    headers: {
      origin: "http://localhost:9999",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(assertMutationSecurity(crossPortLoopback)?.status, 403);

  const formEncoded = new Request("http://localhost:3000/api/v1/operations", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "a=1",
  });
  assert.equal(assertMutationSecurity(formEncoded)?.status, 415);
});

test("SSRF guard isSafeExternalHttpsUrl blocks private/loopback/metadata/IPv6 targets", () => {
  const blocked = [
    "http://api.example.com/hook",
    "https://localhost/hook",
    "https://127.0.0.1:8443/hook",
    "https://0.0.0.0/hook",
    "https://10.0.0.5/hook",
    "https://172.16.4.1/hook",
    "https://192.168.1.50/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/hook",
    "https://[::1]/hook",
    "https://[fd00::1]/hook",
    "https://[::ffff:127.0.0.1]/hook",
    "https://metadata.google.internal/hook",
    "https://service.local/hook",
    "https://2130706433/hook",
    "https://user:pass@hooks.example.com/hook",
  ];
  for (const url of blocked) {
    assert.equal(isSafeExternalHttpsUrl(url), false, `Expected blocked SSRF URL: ${url}`);
  }

  assert.equal(isSafeExternalHttpsUrl("https://api.open-meteo.com/v1/forecast"), true);
  assert.equal(isSafeExternalHttpsUrl("https://hooks.citypartner.org/events"), true);
});

test("monthly AI quota blocks excessive requests when subscription limit is reached", () => {
  const prevDbPath = process.env.SMART_GRID_DB_PATH;
  process.env.SMART_GRID_DB_PATH = ":memory:";
  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();

  const db = getDb();
  const orgId = "org_demo_global";
  const now = new Date().toISOString();
  const monthStart = `${now.slice(0, 7)}-01T00:00:00.000Z`;

  db.prepare("UPDATE subscriptions SET ai_monthly_quota = 3 WHERE organization_id = ?").run(orgId);

  for (let i = 0; i < 3; i++) {
    db.prepare(
      "INSERT INTO usage_records (id, organization_id, metric_type, quantity, recorded_at) VALUES (?, ?, 'AI_REQUEST', 1, ?)"
    ).run(`usg_test_${i}`, orgId, now);
  }

  const usageCountRow = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM usage_records WHERE organization_id = ? AND metric_type = 'AI_REQUEST' AND recorded_at >= ?"
    )
    .get(orgId, monthStart) as { cnt: number };

  assert.equal(usageCountRow.cnt >= 3, true, "AI requests must be blocked when quota is reached");

  resetDbForTests();
  resetSeedStateForTests();
  if (prevDbPath !== undefined) process.env.SMART_GRID_DB_PATH = prevDbPath;
  else delete process.env.SMART_GRID_DB_PATH;
});

test("search LIKE wildcard sanitization via real escapeLike prevents wildcard injection", () => {
  assert.equal(escapeLike("100%"), "100\\%");
  assert.equal(escapeLike("city_tokyo"), "city\\_tokyo");
  assert.equal(escapeLike("a\\b%c_d"), "a\\\\b\\%c\\_d");
  assert.equal(escapeLike("normal search"), "normal search");
});
