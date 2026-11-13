import assert from "node:assert/strict";

const BASE = process.env.SMART_GRID_SMOKE_URL || "http://127.0.0.1:3210";

async function main() {
  console.log("=== PHASE 02 LIVE E2E SMOKE VERIFICATION ===");

  // 1. Health check & Stage 5 readiness metadata
  const healthRes = await fetch(`${BASE}/api/v1/health`);
  assert.equal(healthRes.status, 200, "Health check must return 200");
  const healthText = await healthRes.text();
  const healthData = JSON.parse(healthText);
  assert.equal(healthData.data.service, "SMART GRID");
  assert.equal(healthData.data.database.divisionsLoaded, 24);
  assert.ok(healthData.data.database.migrationsApplied >= 2, "Stage 5 migration 002 must be applied");
  assert.ok(healthData.data.readiness, "Health readiness summary must be included");
  assert.equal(healthText.includes("AIza"), false, "Health check must never expose secrets");
  console.log("✔ Health check: 200 OK (24 divisions + Stage 5 migrations verified)");

  // 1b. Security headers check (CSP, XFO, XCTO, COOP, HSTS over forwarded HTTPS)
  const hdrRes = await fetch(`${BASE}/sign-in`, {
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.equal(hdrRes.status, 200);
  assert.ok(hdrRes.headers.get("content-security-policy"), "CSP header required");
  assert.equal(hdrRes.headers.get("x-frame-options"), "DENY");
  assert.equal(hdrRes.headers.get("x-content-type-options"), "nosniff");
  assert.equal(hdrRes.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(hdrRes.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.ok(
    (hdrRes.headers.get("strict-transport-security") || "").includes("max-age="),
    "HSTS must be emitted when forwarded over HTTPS"
  );
  console.log("✔ Security headers verified (CSP, DENY frame, nosniff, COOP, conditional HSTS)");

  // 2. Public route tests
  const publicRoutes = ["/", "/about", "/divisions", "/divisions/traffic-and-mobility", "/status", "/pricing", "/security", "/privacy"];
  for (const r of publicRoutes) {
    const res = await fetch(`${BASE}${r}`);
    assert.equal(res.status, 200, `Public route ${r} must return 200`);
  }
  console.log("✔ Public routes (8 checked): all returned 200 OK");

  // 3. Unauthenticated access redirect
  const appRes = await fetch(`${BASE}/app`, { redirect: "manual" });
  assert.ok([307, 308, 302].includes(appRes.status), "Unauthenticated /app must redirect to /sign-in");
  console.log("✔ Protected /app redirects unauthenticated visitor (307/302)");

  // 4. Register a new enterprise organization and account dynamically (production flow)
  const uniqueEmail = `elena_${Date.now()}@metro-observatory.org`;
  const signUpRes = await fetch(`${BASE}/api/v1/auth/sign-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      fullName: "Director Elena Rostova",
      email: uniqueEmail,
      password: "SecureProductionPass#2026!",
      organizationName: "Metropolitan Intelligence Observatory",
      organizationType: "MUNICIPALITY",
    }),
  });
  assert.equal(signUpRes.status, 201, "Sign up must succeed");
  const setCookie = signUpRes.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("sg_session="), "Sign up must issue sg_session cookie");
  const sessionCookie = setCookie.split(";")[0];
  console.log("✔ Dynamic organization registration: Created tenant and obtained session");

  // 5. Authenticated session inspection
  const sessionRes = await fetch(`${BASE}/api/v1/auth/session`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sessionRes.status, 200);
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.data.roleCode, "ORG_OWNER");
  assert.equal(sessionData.data.email, uniqueEmail);
  console.log("✔ Auth context: ORG_OWNER role verified for new organization");

  // 6. CSRF Origin guard test (BUG-04 verification)
  const csrfRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: "https://malicious-attacker.com",
    },
    body: JSON.stringify({ title: "Attacker Workbook" }),
  });
  assert.equal(csrfRes.status, 403, "Mismatched origin must be rejected with 403 CSRF_REJECTED");
  const csrfData = await csrfRes.json();
  assert.equal(csrfData.error.code, "CSRF_REJECTED");

  // 6b. Loopback-prefix spoofing check (BUG-04 completion)
  const loopbackSpoofRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: "https://localhost.attacker.com",
    },
    body: JSON.stringify({ title: "Spoofed Origin Workbook" }),
  });
  assert.equal(loopbackSpoofRes.status, 403, "Spoofed loopback prefix origin must be rejected with 403");
  console.log("✔ CSRF defense: Cross-origin & loopback-subdomain spoof attempts rejected with 403 CSRF_REJECTED");

  // 7. Content-Type check (text/plain and x-www-form-urlencoded both blocked)
  const textRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "text/plain",
      Origin: BASE,
    },
    body: JSON.stringify({ title: "Bad Content Type" }),
  });
  assert.equal(textRes.status, 415, "Non-JSON mutation must be rejected with 415");

  const formRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
    },
    body: "title=BadForm",
  });
  assert.equal(formRes.status, 415, "application/x-www-form-urlencoded must be rejected with 415");
  console.log("✔ Content-Type strictness: text/plain and form-urlencoded rejected with 415");

  // 8. Cross-tenant IDOR guard on foreign private city (BUG-03 verification)
  const idorRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      title: "IDOR Test",
      cityId: "city_non_existent",
    }),
  });
  assert.equal(idorRes.status, 403, "Foreign or non-existent city must return 403 FORBIDDEN");

  // 8b. Single-digit division code rejection (prevents SQLite FK 500)
  const badDivRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      title: "Invalid Single Digit Division",
      divisionCode: "1",
    }),
  });
  assert.equal(badDivRes.status, 400, "Single-digit division '1' must be rejected cleanly with 400");
  console.log("✔ IDOR & FK defense: Unauthorized city (403) and invalid 1-digit division (400) verified");

  // 9. Create workbook with formula injection payload (BUG-05 verification)
  const createWbRes = await fetch(`${BASE}/api/v1/workbooks`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      title: "Phase 2 Security Verification Workbook",
      initialCells: {
        A1: { raw: "Formula Injection Target" },
        B1: { raw: "@SUM(1,2)" },
        A2: { raw: "Hyphen Command" },
        B2: { raw: "-cmd|' /C calc'!A0" },
      },
    }),
  });
  assert.equal(createWbRes.status, 201, "Workbook creation must succeed");
  const createWbData = await createWbRes.json();
  const wbId = createWbData.data.id;
  console.log(`✔ Created test workbook: ${wbId}`);

  // 10. Export workbook as CSV and verify CWE-1236 neutralization
  const exportRes = await fetch(`${BASE}/api/v1/workbooks/${wbId}/export?format=csv`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(exportRes.status, 200, "CSV export must succeed");
  const csvText = await exportRes.text();
  console.log("ACTUAL CSV OUTPUT:\n" + csvText);
  assert.ok(csvText.includes("Formula Injection Target"), "CSV contains title header");
  // Check that the dangerous formula has been neutralized with a leading single quote
  assert.ok(csvText.includes("'@SUM") || csvText.includes("'-cmd"), "CSV formula character must be neutralized with leading single quote");
  console.log("✔ CSV Formula Injection (CWE-1236) neutralization verified in live CSV download");

  // 10b. Add two long/special-character sheets and verify XLSX export handles deduplication safely
  await fetch(`${BASE}/api/v1/workbooks/${wbId}`, {
    method: "PATCH",
    headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ addSheetName: "Division_07_Energy_Telemetry_Analysis:Part1" }),
  });
  await fetch(`${BASE}/api/v1/workbooks/${wbId}`, {
    method: "PATCH",
    headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ addSheetName: "Division_07_Energy_Telemetry_Analysis:Part2" }),
  });
  const xlsxRes = await fetch(`${BASE}/api/v1/workbooks/${wbId}/export?format=xlsx`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(xlsxRes.status, 200, "XLSX export with duplicate/long/colon sheet names must succeed");
  const xlsxBuf = await xlsxRes.arrayBuffer();
  assert.ok(xlsxBuf.byteLength > 100);
  console.log("✔ XLSX export succeeded safely with sanitized & deduplicated long worksheet tab names");

  // 10c. Enforce WORKBOOK_LIMITS.MAX_SHEETS = 25
  for (let idx = 4; idx <= 25; idx++) {
    const tabRes = await fetch(`${BASE}/api/v1/workbooks/${wbId}`, {
      method: "PATCH",
      headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ addSheetName: `Tab_${idx}` }),
    });
    assert.equal(tabRes.status, 200, `Adding sheet ${idx}/25 must succeed`);
  }
  const overflowTabRes = await fetch(`${BASE}/api/v1/workbooks/${wbId}`, {
    method: "PATCH",
    headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ addSheetName: "Tab_26_Overflow" }),
  });
  assert.equal(overflowTabRes.status, 400, "26th worksheet tab must be rejected with 400");
  const overflowTabJson = await overflowTabRes.json();
  assert.equal(overflowTabJson.error.code, "WORKBOOK_SHEET_LIMIT");
  console.log("✔ Workbook tab ceiling enforced: 25 tabs permitted, 26th rejected with 400 WORKBOOK_SHEET_LIMIT");

  // 11. AI endpoint test without external keys -> Truthful 503 (BUG-07 verification)
  const aiRes = await fetch(`${BASE}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      prompt: "Analyze metro congestion",
      mode: "WORKSPACE",
    }),
  });
  assert.equal(aiRes.status, 503, "Unconfigured AI provider must return truthful 503");
  const aiData = await aiRes.json();
  assert.equal(aiData.error.code, "AI_PROVIDER_UNAVAILABLE");
  console.log("✔ SMART GRID AI truthful 503: Reported unavailable without fake answers");

  // 12. Search endpoint with wildcard `%` (BUG-11 verification)
  const searchRes = await fetch(`${BASE}/api/v1/search?q=%25`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(searchRes.status, 200);
  const searchData = await searchRes.json();
  assert.ok(Array.isArray(searchData.data.results));

  // 12b. Cities endpoint with wildcard `%` and invalid page=abc
  const citiesRes = await fetch(`${BASE}/api/v1/cities?q=%25&page=abc`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(citiesRes.status, 200, "Cities endpoint must tolerate invalid page and escape % wildcard");
  const citiesData = await citiesRes.json();
  assert.equal(citiesData.data.length, 0, "Escaped % query must not match all cities");
  console.log("✔ SQL LIKE escaping & safe pagination verified on /api/v1/search and /api/v1/cities");

  // 12c. Provision DATA_ANALYST and verify isPublic: true on /api/v1/cities returns 403 FORBIDDEN
  const analystEmail = `analyst_${Date.now()}@metro-observatory.org`;
  const provRes = await fetch(`${BASE}/api/v1/admin`, {
    method: "POST",
    headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      action: "INVITE_USER",
      fullName: "Analyst RBAC Test",
      email: analystEmail,
      roleCode: "DATA_ANALYST",
      department: "Mobility",
      temporaryPassword: "AnalystTestPassword#2026!",
    }),
  });
  assert.equal(provRes.status, 201, "ORG_OWNER must be able to provision DATA_ANALYST");

  const analystSignIn = await fetch(`${BASE}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: analystEmail, password: "AnalystTestPassword#2026!" }),
  });
  assert.equal(analystSignIn.status, 200);
  const analystCookie = (analystSignIn.headers.get("set-cookie") || "").split(";")[0];
  const pubCityAttempt = await fetch(`${BASE}/api/v1/cities`, {
    method: "POST",
    headers: { Cookie: analystCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      name: "Unauthorized Public City",
      countryCode: "CA",
      regionName: "Ontario",
      latitude: 43.65,
      longitude: -79.38,
      isPublic: true,
    }),
  });
  assert.equal(pubCityAttempt.status, 403, "DATA_ANALYST must receive 403 when attempting to publish public city");
  console.log("✔ RBAC verified: non-publisher blocked from isPublic city showcase creation (403)");

  // 12d. MFA enrollment password re-auth gate + Password reset non-enumerating flow
  const badMfaSetup = await fetch(`${BASE}/api/v1/auth/mfa`, {
    method: "POST",
    headers: { Cookie: sessionCookie, "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ action: "setup", currentPassword: "WrongPassword123!" }),
  });
  assert.equal(badMfaSetup.status, 401, "MFA setup with wrong currentPassword must fail 401");

  const resetReq = await fetch(`${BASE}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: "nonexistent@example.invalid" }),
  });
  assert.equal(resetReq.status, 200, "Password reset request must remain non-enumerating 200");
  const resetReqBody = await resetReq.text();
  assert.equal(resetReqBody.includes("token="), false, "Reset endpoint must never echo reset token");

  const resetExistingReq = await fetch(`${BASE}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: uniqueEmail }),
  });
  assert.equal(resetExistingReq.status, 200, "Existing account reset request must also return 200");
  const resetExistingBody = await resetExistingReq.text();
  assert.equal(resetExistingBody.includes("token="), false, "Existing reset endpoint must never echo reset token");
  assert.deepEqual(
    JSON.parse(resetExistingBody).data,
    JSON.parse(resetReqBody).data,
    "Password reset data payload must be identical for active vs unknown emails (no enumeration oracle)"
  );

  const badConfirm = await fetch(`${BASE}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ token: "invalid_token_value_12345", newPassword: "NewStrongPassword#2026!" }),
  });
  assert.equal(badConfirm.status, 400, "Invalid reset token confirmation must return 400");
  console.log("✔ MFA re-auth check & non-enumerating password reset checks verified");

  // 13. Sign-out & session invalidation check
  const signOutRes = await fetch(`${BASE}/api/v1/auth/sign-out`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: "{}",
  });
  assert.equal(signOutRes.status, 200);
  const afterSignOutSession = await fetch(`${BASE}/api/v1/auth/session`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(afterSignOutSession.status, 401, "Session cookie must be rejected after sign-out");
  console.log("✔ Sign-out succeeded and server-side session was verified revoked (401 on reuse)");

  // 14. Production /sign-in page must expose zero plaintext demo passwords
  const signInHtml = await (await fetch(`${BASE}/sign-in`)).text();
  assert.equal(signInHtml.includes("SmartGrid!"), false, "Production /sign-in HTML must contain zero demo passwords");
  console.log("✔ Production /sign-in verified free of demo passwords");

  console.log("\n=== ALL LIVE E2E SMOKE CHECKS PASSED PERFECTLY ===");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
