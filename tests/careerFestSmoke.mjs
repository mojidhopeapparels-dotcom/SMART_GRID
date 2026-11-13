import assert from "node:assert/strict";

const BASE = process.env.SMART_GRID_CAREER_FEST_SMOKE_URL || "http://127.0.0.1:3211";

function extractCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  assert.ok(raw.includes("sg_session="), `Expected sg_session cookie, got: ${raw}`);
  return raw.split(";")[0];
}

async function postJson(path, body, cookie, origin = BASE) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("=== SMART GRID CAREER FEST 2026 — LIVE HTTP E2E VERIFICATION ===");

  // 1. Health & migration 003 verification
  const healthRes = await fetch(`${BASE}/api/v1/health`);
  assert.equal(healthRes.status, 200, "Health endpoint must return 200");
  const healthJson = await healthRes.json();
  assert.equal(healthJson.data.database.divisionsLoaded, 24);
  assert.ok(healthJson.data.database.migrationsApplied >= 3, "Migration 003 must be applied");
  assert.equal(healthJson.data.database.latestMigration, "003_career_fest.sql");
  console.log("✔ Health check: 200 OK (24 divisions, migration 003_career_fest.sql applied)");

  // 2. Public Career Fest landing page & brand assertions
  const cfRes = await fetch(`${BASE}/career-fest`);
  assert.equal(cfRes.status, 200, "/career-fest must return 200");
  assert.equal(cfRes.headers.get("x-frame-options"), "DENY");
  assert.equal(cfRes.headers.get("x-content-type-options"), "nosniff");
  assert.ok(cfRes.headers.get("content-security-policy"), "CSP header expected");
  const cfHtml = await cfRes.text();
  assert.ok(cfHtml.includes("WELCOME TO SMART GRID"), "Expected WELCOME TO SMART GRID heading");
  assert.ok(cfHtml.includes("The Intelligence Behind Tomorrow"), "Expected tagline");
  assert.ok(cfHtml.includes("EXPLORE SMART GRID"), "Expected primary CTA label");
  assert.ok(cfHtml.includes("six-member"), "Expected six-member interdisciplinary team copy");
  console.log("✔ Landing page /career-fest: 200 OK + brand copy & security headers verified");

  // 3. Unauthenticated /app redirects
  const unauthApp = await fetch(`${BASE}/app`, { redirect: "manual" });
  assert.ok([302, 307, 308].includes(unauthApp.status), "Unauthenticated /app must redirect");
  console.log("✔ Unauthenticated /app redirect verified");

  // 4. CSRF protection on /api/career-fest/session
  const csrfStart = await postJson("/api/career-fest/session", {}, undefined, "https://attacker.invalid");
  assert.equal(csrfStart.status, 403, "Cross-origin POST /api/career-fest/session must return 403");
  console.log("✔ CSRF cross-origin protection verified on /api/career-fest/session");

  // 5. Enter Career Fest visitor mode (Visitor A)
  const enterA = await postJson("/api/career-fest/session", {});
  assert.equal(enterA.status, 201, "Visitor A entry must return 201");
  const enterAJson = await enterA.json();
  assert.equal(enterAJson.data.roleCode, "CAREER_FEST_VISITOR");
  assert.equal(enterAJson.data.organizationId, "org_career_fest_demo");
  assert.equal(enterAJson.data.durationSeconds, 1800);
  const cookieA = extractCookie(enterA);
  console.log("✔ Visitor A 30-minute session issued (1800s TTL, CAREER_FEST_VISITOR)");

  // 6. Status endpoint verification
  const statusA = await fetch(`${BASE}/api/career-fest/session/status`, {
    headers: { Cookie: cookieA },
  });
  assert.equal(statusA.status, 200);
  const statusAJson = await statusA.json();
  assert.equal(statusAJson.data.active, true);
  assert.ok(statusAJson.data.remainingSeconds > 1700 && statusAJson.data.remainingSeconds <= 1800);
  console.log("✔ /api/career-fest/session/status verified live countdown active");

  // 7. Approved Career Fest workspace routes
  const approvedRoutes = [
    "/app",
    "/app/divisions",
    "/app/divisions/energy-and-power-grid",
    "/app/cities",
    "/app/cities/dhaka",
    "/app/digital-twin",
    "/app/scenarios",
    "/app/ai",
    "/app/sheets",
    "/app/search",
    "/app/reports",
    "/app/city-pulse",
    "/app/sustainability",
    "/app/data-catalog",
    "/app/analytics",
    "/docs",
  ];
  for (const route of approvedRoutes) {
    const res = await fetch(`${BASE}${route}`, { headers: { Cookie: cookieA } });
    assert.equal(res.status, 200, `Approved visitor route ${route} must return 200, got ${res.status}`);
  }
  const appHomeHtml = await (await fetch(`${BASE}/app`, { headers: { Cookie: cookieA } })).text();
  assert.ok(appHomeHtml.includes("Career Fest Visitor"), "Expected Career Fest visitor banner in /app");
  const settingsHtml = await (await fetch(`${BASE}/app/settings`, { headers: { Cookie: cookieA } })).text();
  assert.ok(settingsHtml.includes("FORBIDDEN"), "Visitor /app/settings must render HTTP 403 restriction card");
  console.log(`✔ All ${approvedRoutes.length} approved routes return 200 + Banner + /app/settings restricted`);

  // 8. Prohibited API & privilege-escalation denials (HTTP 403)
  const forbiddenGets = [
    "/api/v1/admin",
    "/api/v1/admin?scope=audit",
    "/api/v1/admin?scope=developer",
    "/api/v1/admin?scope=billing",
  ];
  for (const endpoint of forbiddenGets) {
    const res = await fetch(`${BASE}${endpoint}`, { headers: { Cookie: cookieA } });
    assert.equal(res.status, 403, `Expected 403 on ${endpoint}, got ${res.status}`);
  }
  const forbiddenPosts = [
    ["/api/v1/admin", { action: "UPDATE_PLAN", planCode: "ENTERPRISE" }],
    ["/api/v1/auth/mfa", { action: "setup", currentPassword: "test" }],
    ["/api/v1/cities", { name: "Injected City" }],
    ["/api/v1/datasets", { name: "Injected Dataset" }],
    ["/api/v1/integrations", { name: "Injected Source" }],
    ["/api/v1/operations", { entity: "project", cityId: "city_dhaka", divisionCode: "01", title: "X", description: "Test" }],
  ];
  for (const [ep, payload] of forbiddenPosts) {
    const res = await postJson(ep, payload, cookieA);
    assert.equal(res.status, 403, `Expected 403 on POST ${ep}, got ${res.status}`);
  }
  const orgSwitchRes = await fetch(`${BASE}/api/v1/auth/session`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookieA },
    body: JSON.stringify({ organizationId: "org_demo_global" }),
  });
  assert.equal(orgSwitchRes.status, 403, "Visitor cannot switch into org_demo_global");
  console.log("✔ Strict server-side 403 denials verified across admin, audit, dev, billing, MFA, org-switch, ops");

  // 9. SHEETS starter template protection & cross-visitor isolation (Visitor A vs Visitor B)
  const starterPatch = await fetch(`${BASE}/api/v1/workbooks/wb_cf_starter`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookieA },
    body: JSON.stringify({ title: "Tampered Starter" }),
  });
  assert.equal(starterPatch.status, 403, "Starter showcase workbook must be immutable for visitors");

  const createWbA = await postJson("/api/v1/workbooks", {
    title: "Visitor A Energy Sheet",
    cityId: "city_dhaka",
    divisionCode: "07",
  }, cookieA);
  assert.equal(createWbA.status, 201);
  const wbAId = (await createWbA.json()).data.id;

  const exportWbA = await fetch(`${BASE}/api/v1/workbooks/${wbAId}/export?format=csv`, {
    headers: { Cookie: cookieA },
  });
  assert.equal(exportWbA.status, 200);

  // Visitor B opens separate session
  const enterB = await postJson("/api/career-fest/session", {});
  assert.equal(enterB.status, 201);
  const cookieB = extractCookie(enterB);

  const listB = await (await fetch(`${BASE}/api/v1/workbooks`, { headers: { Cookie: cookieB } })).json();
  assert.equal(listB.data.some((w) => w.id === wbAId), false, "Visitor B must NOT see Visitor A workbook");
  assert.equal((await fetch(`${BASE}/api/v1/workbooks/${wbAId}`, { headers: { Cookie: cookieB } })).status, 404);
  assert.equal((await fetch(`${BASE}/api/v1/workbooks/${wbAId}/export?format=csv`, { headers: { Cookie: cookieB } })).status, 404);
  assert.equal(
    (
      await fetch(`${BASE}/api/v1/workbooks/${wbAId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookieB },
        body: JSON.stringify({ title: "Hijack" }),
      })
    ).status,
    404
  );
  assert.equal(
    (
      await fetch(`${BASE}/api/v1/workbooks/${wbAId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookieB },
        body: "{}",
      })
    ).status,
    404
  );
  console.log("✔ Cross-visitor SHEETS isolation & read-only starter template protection verified (403/404)");

  // 10. AI truthful 503 check & password sign-in block for visitor account
  const aiRes = await postJson("/api/v1/ai/chat", { prompt: "Summarize Dhaka showcase data status." }, cookieA);
  assert.equal(aiRes.status, 503, "Without provider keys, AI must return 503 AI_PROVIDER_UNAVAILABLE");

  const directSignIn = await postJson("/api/v1/auth/sign-in", {
    email: "visitor-sandbox@careerfest.smartgrid.invalid",
    password: "any-password-attempt-123",
  });
  assert.equal(directSignIn.status, 401, "Visitor sandbox user cannot authenticate via standard sign-in");
  console.log("✔ AI truthful 503 & non-login visitor credential block verified");

  // 11. Explicit Exit Demo & server-side cookie invalidation
  const endA = await postJson("/api/career-fest/session/end", {}, cookieA);
  assert.equal(endA.status, 200);
  const endAJson = await endA.json();
  assert.equal(endAJson.data.ended, true);

  const replayAfterEnd = await fetch(`${BASE}/api/v1/workbooks`, { headers: { Cookie: cookieA } });
  assert.equal(replayAfterEnd.status, 401, "Ended visitor session cookie must fail with 401 on replay");
  const statusAfterEnd = await (
    await fetch(`${BASE}/api/career-fest/session/status`, { headers: { Cookie: cookieA } })
  ).json();
  assert.equal(statusAfterEnd.data.active, false);
  console.log("✔ Explicit Exit Demo revoked session & blocked replay (401)");
  console.log("=== ALL CAREER FEST LIVE HTTP E2E CHECKS PASSED ===");
}

main().catch((err) => {
  console.error("Career Fest Smoke Test FAILED:", err);
  process.exit(1);
});
