import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb, resetDbForTests } from "../src/lib/db";
import { ensureSeeded, resetSeedStateForTests } from "../src/lib/db/seed";
import {
  canPublishPublicCity,
  getRolePermissions,
  hasPermission,
  SYSTEM_ROLES,
} from "../src/lib/auth/rbac";
import { retrievePermittedContext } from "../src/lib/ai/provider";
import { commitAiTurnAndUsage, reserveAiQuotaSlot } from "../src/lib/ai/quota";
import {
  CAREER_FEST_APPROVED_PERMISSIONS,
  CAREER_FEST_MAX_AI_TURNS_PER_SESSION,
  CAREER_FEST_MAX_WORKBOOKS_PER_SESSION,
  CAREER_FEST_ORG_ID,
  CAREER_FEST_ROLE_CODE,
  CAREER_FEST_SESSION_TTL_MS,
  CAREER_FEST_STARTER_WORKBOOK_ID,
  CAREER_FEST_USER_ID,
} from "../src/lib/careerFest/constants";
import {
  canVisitorAccessWorkbook,
  getCareerFestSessionAiTurnCount,
  getCareerFestSessionWorkbookCount,
  isCareerFestAiLimitReached,
  isCareerFestWorkbookQuotaReached,
  recordCareerFestEvent,
  resolveEffectiveSessionExpiryMs,
  revokeSessionIfNeeded,
} from "../src/lib/careerFest/service";

function setupFreshMemoryDb(demoMode: "true" | "false" = "false") {
  process.env.SMART_GRID_DB_PATH = ":memory:";
  process.env.SMART_GRID_DEMO_MODE = demoMode;
  resetDbForTests();
  resetSeedStateForTests();
  ensureSeeded();
  return getDb();
}

test("CAREER_FEST_VISITOR role grants only approved permissions and blocks all privileged capabilities", () => {
  const role = SYSTEM_ROLES.find((r) => r.code === CAREER_FEST_ROLE_CODE);
  assert.ok(role, "CAREER_FEST_VISITOR role must exist in SYSTEM_ROLES");

  const perms = getRolePermissions(CAREER_FEST_ROLE_CODE);
  for (const allowed of CAREER_FEST_APPROVED_PERMISSIONS) {
    assert.equal(
      hasPermission(perms, allowed),
      true,
      `Expected Career Fest visitor to have approved permission ${allowed}`
    );
  }

  const forbidden = [
    "org:manage",
    "users:manage",
    "cities:write",
    "data:write",
    "integrations:manage",
    "operations:write",
    "workflows:approve",
    "reports:publish",
    "audit:read",
    "developer:manage",
    "billing:manage",
  ];
  for (const denied of forbidden) {
    assert.equal(
      hasPermission(perms, denied),
      false,
      `Career Fest visitor must NOT possess privileged permission ${denied}`
    );
  }

  assert.equal(canPublishPublicCity(perms), false);
});

test("ensureSeeded initializes Career Fest sandbox cleanly in production mode and when upgrading existing DBs", () => {
  const prevDb = process.env.SMART_GRID_DB_PATH;
  const prevDemo = process.env.SMART_GRID_DEMO_MODE;
  try {
    // 1. Fresh DB with SMART_GRID_DEMO_MODE=false (strict production parity)
    const db = setupFreshMemoryDb("false");

    const demoAdmin = db.prepare("SELECT id FROM users WHERE id = 'usr_demo_admin'").get();
    assert.equal(demoAdmin, undefined, "Production mode must not seed demo admin credentials");

    const cfOrg = db.prepare("SELECT id, slug FROM organizations WHERE id = ?").get(CAREER_FEST_ORG_ID) as
      | { id: string; slug: string }
      | undefined;
    assert.equal(cfOrg?.id, CAREER_FEST_ORG_ID);
    assert.equal(cfOrg?.slug, "career-fest-2026");

    const cfStarter = db
      .prepare("SELECT id, owner_session_id FROM workbooks WHERE id = ?")
      .get(CAREER_FEST_STARTER_WORKBOOK_ID) as { id: string; owner_session_id: string | null } | undefined;
    assert.equal(cfStarter?.id, CAREER_FEST_STARTER_WORKBOOK_ID);
    assert.equal(cfStarter?.owner_session_id, null);

    // 2. Simulate upgrade path where divisions >= 24 already existed prior to migration 003 / Career Fest seed
    db.prepare("DELETE FROM seed_metadata WHERE seed_key = 'career_fest_seed'").run();
    db.prepare("DELETE FROM workbooks WHERE organization_id = ?").run(CAREER_FEST_ORG_ID);
    resetSeedStateForTests();
    ensureSeeded();

    const restoredStarter = db
      .prepare("SELECT id FROM workbooks WHERE id = ?")
      .get(CAREER_FEST_STARTER_WORKBOOK_ID);
    assert.ok(restoredStarter, "Upgrade path must repair Career Fest seed even when divisions >= 24");
  } finally {
    resetDbForTests();
    resetSeedStateForTests();
    if (prevDb !== undefined) process.env.SMART_GRID_DB_PATH = prevDb;
    else delete process.env.SMART_GRID_DB_PATH;
    if (prevDemo !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemo;
    else delete process.env.SMART_GRID_DEMO_MODE;
  }
});

test("30-minute Career Fest expiry ceiling clamps tampered expires_at and revokes expired sessions", () => {
  const prevDb = process.env.SMART_GRID_DB_PATH;
  const prevDemo = process.env.SMART_GRID_DEMO_MODE;
  try {
    const db = setupFreshMemoryDb("false");

    const createdAt = "2026-11-13T10:00:00.000Z";
    const tamperedExpiresAt = "2026-11-20T10:00:00.000Z"; // +7 days attempt
    const effective = resolveEffectiveSessionExpiryMs({
      isCareerFest: true,
      createdAt,
      expiresAt: tamperedExpiresAt,
    });
    assert.equal(effective, Date.parse(createdAt) + CAREER_FEST_SESSION_TTL_MS);

    const normalSessionExpiry = resolveEffectiveSessionExpiryMs({
      isCareerFest: false,
      createdAt,
      expiresAt: tamperedExpiresAt,
    });
    assert.equal(normalSessionExpiry, Date.parse(tamperedExpiresAt));

    const sesId = `cf_expired_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO sessions (id, user_id, active_organization_id, token_hash, is_career_fest, expires_at, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).run(sesId, CAREER_FEST_USER_ID, CAREER_FEST_ORG_ID, crypto.randomUUID(), "2026-11-13T10:30:00.000Z", createdAt);

    revokeSessionIfNeeded(db, sesId, true);
    const revokedRow = db.prepare("SELECT revoked_at FROM sessions WHERE id = ?").get(sesId) as {
      revoked_at: string | null;
    };
    assert.ok(revokedRow.revoked_at, "Expired Career Fest session must be stamped revoked_at");

    const evtRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM career_fest_events WHERE event_type = 'VISITOR_EXPIRED'")
      .get() as { cnt: number };
    assert.ok(evtRow.cnt >= 1);
  } finally {
    resetDbForTests();
    resetSeedStateForTests();
    if (prevDb !== undefined) process.env.SMART_GRID_DB_PATH = prevDb;
    else delete process.env.SMART_GRID_DB_PATH;
    if (prevDemo !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemo;
    else delete process.env.SMART_GRID_DEMO_MODE;
  }
});

test("cross-visitor workbook isolation, template read-only enforcement, and per-session quotas hold", () => {
  const prevDb = process.env.SMART_GRID_DB_PATH;
  const prevDemo = process.env.SMART_GRID_DEMO_MODE;
  try {
    const db = setupFreshMemoryDb("false");
    const visitorA = { isCareerFestVisitor: true, sessionId: "cf_visitor_A" };
    const visitorB = { isCareerFestVisitor: true, sessionId: "cf_visitor_B" };

    // Shared starter template is readable by visitors, but immutable via PATCH/DELETE
    const starter = { owner_session_id: null };
    assert.equal(canVisitorAccessWorkbook(starter, visitorA, "read").allowed, true);
    const starterWrite = canVisitorAccessWorkbook(starter, visitorA, "write");
    assert.equal(starterWrite.allowed, false);
    if (!starterWrite.allowed) {
      assert.equal(starterWrite.status, 403);
    }

    // Visitor A's private workbook is isolated from Visitor B (404 NOT_FOUND on read & write)
    const wbA = { owner_session_id: "cf_visitor_A" };
    assert.equal(canVisitorAccessWorkbook(wbA, visitorA, "read").allowed, true);
    assert.equal(canVisitorAccessWorkbook(wbA, visitorA, "write").allowed, true);

    const readByB = canVisitorAccessWorkbook(wbA, visitorB, "read");
    const writeByB = canVisitorAccessWorkbook(wbA, visitorB, "write");
    assert.equal(readByB.allowed, false);
    assert.equal(writeByB.allowed, false);
    if (!readByB.allowed && !writeByB.allowed) {
      assert.equal(readByB.status, 404);
      assert.equal(writeByB.status, 404);
    }

    // Per-session workbook ceiling protects storage without affecting other visitors
    const now = new Date().toISOString();
    for (let i = 0; i < CAREER_FEST_MAX_WORKBOOKS_PER_SESSION; i++) {
      db.prepare(
        `INSERT INTO workbooks (id, organization_id, owner_user_id, owner_session_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(`wb_cf_a_${i}`, CAREER_FEST_ORG_ID, CAREER_FEST_USER_ID, "cf_visitor_A", `Visitor A Sheet ${i}`, now, now);
    }
    assert.equal(getCareerFestSessionWorkbookCount(db, CAREER_FEST_ORG_ID, "cf_visitor_A"), CAREER_FEST_MAX_WORKBOOKS_PER_SESSION);
    assert.equal(isCareerFestWorkbookQuotaReached(db, CAREER_FEST_ORG_ID, "cf_visitor_A"), true);
    assert.equal(isCareerFestWorkbookQuotaReached(db, CAREER_FEST_ORG_ID, "cf_visitor_B"), false);
  } finally {
    resetDbForTests();
    resetSeedStateForTests();
    if (prevDb !== undefined) process.env.SMART_GRID_DB_PATH = prevDb;
    else delete process.env.SMART_GRID_DB_PATH;
    if (prevDemo !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemo;
    else delete process.env.SMART_GRID_DEMO_MODE;
  }
});

test("AI sessions, per-session turn caps, tenant RAG retrieval, and privacy analytics isolate visitors cleanly", () => {
  const prevDb = process.env.SMART_GRID_DB_PATH;
  const prevDemo = process.env.SMART_GRID_DEMO_MODE;
  try {
    const db = setupFreshMemoryDb("false");

    // Tenant retrieval inside org_career_fest_demo must never leak org_demo_global or org_partner_metro
    const cfRetrieval = retrievePermittedContext({
      organizationId: CAREER_FEST_ORG_ID,
      query: "Dhaka Toronto floodplain PM2.5",
    });
    const citedIds = new Set(cfRetrieval.citations.map((c) => c.id));
    assert.ok(citedIds.has("ds_cf_aq"));
    assert.equal(citedIds.has("ds_toronto_flood"), false);
    assert.equal(citedIds.has("ds_dhaka_aq"), false);

    // Commit AI turns scoped to Visitor A up to CAREER_FEST_MAX_AI_TURNS_PER_SESSION
    const aiSessionA = "ais_cf_visitor_a";
    for (let i = 0; i < CAREER_FEST_MAX_AI_TURNS_PER_SESSION; i++) {
      const slot = reserveAiQuotaSlot({
        organizationId: CAREER_FEST_ORG_ID,
        userId: CAREER_FEST_USER_ID,
      });
      assert.equal(slot.ok, true);
      if (slot.ok) {
        commitAiTurnAndUsage({
          reservationId: slot.reservationId,
          organizationId: CAREER_FEST_ORG_ID,
          userId: CAREER_FEST_USER_ID,
          ownerSessionId: "cf_visitor_A",
          sessionId: aiSessionA,
          isNewSession: i === 0,
          cityId: "city_dhaka",
          divisionCode: "05",
          prompt: `Question ${i + 1}`,
          replyText: `Reply ${i + 1}`,
          provider: "test",
          model: "test-model",
          citationsJson: "[]",
        });
      }
    }

    assert.equal(
      getCareerFestSessionAiTurnCount(db, CAREER_FEST_ORG_ID, "cf_visitor_A"),
      CAREER_FEST_MAX_AI_TURNS_PER_SESSION
    );
    assert.equal(isCareerFestAiLimitReached(db, CAREER_FEST_ORG_ID, "cf_visitor_A"), true);
    assert.equal(isCareerFestAiLimitReached(db, CAREER_FEST_ORG_ID, "cf_visitor_B"), false);

    // Privacy-conscious Career Fest analytics stores zero PII columns
    recordCareerFestEvent("LANDING_VIEW", "99_invalid");
    recordCareerFestEvent("FEATURE_OPEN", "05");
    const cols = db.prepare("PRAGMA table_info(career_fest_events)").all() as { name: string }[];
    assert.deepEqual(
      cols.map((c) => c.name),
      ["id", "event_type", "division_code", "created_at"]
    );
    const featureEvt = db
      .prepare("SELECT division_code FROM career_fest_events WHERE event_type = 'FEATURE_OPEN'")
      .get() as { division_code: string | null };
    assert.equal(featureEvt.division_code, "05");
    const invalidDivEvt = db
      .prepare("SELECT division_code FROM career_fest_events WHERE event_type = 'LANDING_VIEW'")
      .get() as { division_code: string | null };
    assert.equal(invalidDivEvt.division_code, null);
  } finally {
    resetDbForTests();
    resetSeedStateForTests();
    if (prevDb !== undefined) process.env.SMART_GRID_DB_PATH = prevDb;
    else delete process.env.SMART_GRID_DB_PATH;
    if (prevDemo !== undefined) process.env.SMART_GRID_DEMO_MODE = prevDemo;
    else delete process.env.SMART_GRID_DEMO_MODE;
  }
});
