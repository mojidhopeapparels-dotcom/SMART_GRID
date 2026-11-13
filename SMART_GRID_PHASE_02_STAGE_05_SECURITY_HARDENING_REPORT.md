# SMART GRID — PHASE 02, STAGE 5: SECURITY HARDENING REPORT (RECOVERED)

**Project:** SMART GRID — *The Intelligence Behind Tomorrow's Cities.*  
**Repository:** `F:\SMART_GRID`  
**Phase / Stage:** Phase 02, Stage 5 — Production Preparation (Forensic Recovery Verification)  
**Assessment Date:** 2026-11-13  

---

## 1. Executive Summary

Stage 5 security controls implemented in code and verified during this forensic audit substantially close every **P1** and **P2** security blocker identified in Phase 02 Stage 4 (`STAGE4-P1-01`, `STAGE4-P2-01`, `STAGE4-P2-02`, `STAGE4-P2-04`, `STAGE4-P2-05a/b/c`). During this forensic audit, one additional P2 defect was discovered and fixed: an account-enumeration oracle in [password-reset/route.ts](file:///F:/SMART_GRID/src/app/api/v1/auth/password-reset/route.ts) where missing mail-relay configuration altered the HTTP 200 message depending on whether the submitted email existed.

**Overall Security Verification Status:** **VERIFIED PASS** (for application code, HTTP headers, auth lifecycle, RBAC, CSRF/SSRF, and multi-tenant isolation; external deployment TLS termination, SMTP/email webhook transport, and cleaning legacy demo accounts in `F:\SMART_GRID\data\smart_grid.db` remain mandatory operational steps prior to external launch).

---

## 2. HTTP Security Headers & Transport Controls

Verified in [next.config.mjs](file:///F:/SMART_GRID/next.config.mjs#L1-L82) and confirmed live via `next start -H 127.0.0.1 -p 3210` (`NODE_ENV=production`):

| Header | Configuration / Live Observed Value | Verification Method | Status |
|---|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (dev adds `'unsafe-eval'`) | Source inspect + Live `GET /` & `GET /sign-in` | `VERIFIED PASS` |
| `X-Frame-Options` | `DENY` | Source + Live HTTP check | `VERIFIED PASS` |
| `X-Content-Type-Options` | `nosniff` | Source + Live HTTP check | `VERIFIED PASS` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Source + Live HTTP check | `VERIFIED PASS` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` | Source + Live HTTP check | `VERIFIED PASS` |
| `Cross-Origin-Opener-Policy` | `same-origin` | Source + Live HTTP check | `VERIFIED PASS` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` emitted when `x-forwarded-proto: https` is present, or statically in `NODE_ENV=production` when `SMART_GRID_ENABLE_HSTS=true` or `NEXT_PUBLIC_APP_URL` starts with `https://`; omitted over plain HTTP localhost | Live check with & without `X-Forwarded-Proto: https` | `VERIFIED PASS` |
| `X-Powered-By` | Disabled (`poweredByHeader: false`; header absent `null` in live check) | Live HTTP check | `VERIFIED PASS` |

**Residual CSP Note:** `script-src` retains `'unsafe-inline'` in production to accommodate Next.js inline bootstrap scripts without runtime nonce plumbing. Future CSP strictness can adopt per-request nonces if proxy/middleware nonce injection is added.

---

## 3. Authentication, Password Reset & MFA Lifecycle Hardening

1. **Non-Enumerating Password Reset Flow (`STAGE4-P2-02` + Forensic Fix):**
   - [password-reset/route.ts](file:///F:/SMART_GRID/src/app/api/v1/auth/password-reset/route.ts#L24-L122): Rate-limited (`10/min` per IP, `5/5min` per email), generates 32-byte opaque tokens stored only as SHA-256 hashes in `password_reset_tokens` with `15`-minute TTL, invalidates prior open tokens atomically in a transaction, and dispatches through [mailer.ts](file:///F:/SMART_GRID/src/lib/email/mailer.ts).
   - **Forensic Fix Applied:** Previously, when no email relay was configured, active accounts returned `"Reset request recorded. External SMTP/email relay integration is required..."` while unknown/inactive accounts returned `"If an active account matches that email address..."`, leaking account existence. Updated to evaluate `isEmailDeliveryConfigured()` independently of user existence so active and unknown emails produce identical `data` payloads (`accepted`, `expiresInMinutes`, `message`). Verified live in `tests/live_smoke.mjs`.
   - [password-reset/confirm/route.ts](file:///F:/SMART_GRID/src/app/api/v1/auth/password-reset/confirm/route.ts): Validates hashed token freshness (`used_at IS NULL`, `expires_at > now`), updates salted `scrypt` password hash, marks token consumed, and revokes all active user sessions in `sessions` atomically.
   - **Operational Constraint:** `mailer.ts` implements HTTPS relay dispatch via `SMART_GRID_EMAIL_WEBHOOK_URL` (`8s` timeout); declaring `SMART_GRID_SMTP_HOST` alone logs `SMTP_TRANSPORT_REQUIRES_RELAY` (`channel: "smtp_unwired"`) and returns `INTEGRATION_REQUIRED`.

2. **Server-Bound MFA Enrollment & Single-Use Backup Recovery Codes (`STAGE4-P2-02`):**
   - [mfa/route.ts](file:///F:/SMART_GRID/src/app/api/v1/auth/mfa/route.ts): Actions `setup`, `enable`, `disable`, and `regenerate_recovery` require `currentPassword` verified via `verifyPassword()`. Pending secrets are stored server-side in `mfa_pending_enrollments` (`10`-minute expiration) instead of trusting client-submitted secrets during `enable`.
   - [mfaRecovery.ts](file:///F:/SMART_GRID/src/lib/auth/mfaRecovery.ts): Generates 8 normalized single-use recovery backup codes hashed with SHA-256 in `mfa_recovery_codes`. Live test verified `401` on `setup` with wrong password; unit tests verified single-use consumption and regeneration invalidation.

3. **Trusted Proxy & Session Cookie Security (`STAGE4-P2-02`):**
   - [guards.ts](file:///F:/SMART_GRID/src/lib/auth/guards.ts) `resolveClientIpFromHeaders()`: Ignores `X-Forwarded-For` / `X-Real-IP` (`returns "direct-unproxied"`) unless `SMART_GRID_TRUST_PROXY=true`, defeating client rate-limit header spoofing. Verified in unit tests.
   - [session.ts](file:///F:/SMART_GRID/src/lib/auth/session.ts#L123-L150): Session cookies are `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and automatically set `secure: true` when `SMART_GRID_COOKIE_SECURE=true`, `x-forwarded-proto: https`, or `origin: https://...`.

4. **Production Demo Seed Suppression (`STAGE4-P2-03`):**
   - In `NODE_ENV=production` with `SMART_GRID_DEMO_MODE=false` (`task-2374` smoke server), `demo@` / `@smartgrid.local` accounts are suppressed (`demoUsers: 0`), `POST /api/v1/auth/sign-in` for `admin@smartgrid.local` returned `401`, `/sign-in` HTML exposed `0` demo passwords, and `SMART_GRID_BOOTSTRAP_ADMIN_*` provisioned a valid initial administrator (`200 OK` on login).

---

## 4. RBAC, Multi-Tenant Isolation, CSRF, SSRF & Injection Defenses

| Domain | Mechanism Verified | Verification Evidence | Status |
|---|---|---|---|
| **Public City Publish RBAC** (`STAGE4-P2-04`) | `canPublishPublicCity()` restricts `isPublic: true` on `POST /api/v1/cities` to `reports:publish` or `users:manage`. | Unit test (`rbac.ts`) + Live smoke (`DATA_ANALYST` -> `403 FORBIDDEN`) | `VERIFIED PASS` |
| **Cross-Tenant IDOR Isolation** | Every workspace, city, workbook, operation, dataset, and search query filters `organization_id = auth.ctx.organizationId`. | Tenant B vs Tenant A live test: `GET` workbook `404`, CSV export `404`, search `0` hits; foreign city creation `403`. | `VERIFIED PASS` |
| **CSRF & Content-Type** | `assertMutationSecurity()` checks origin match (blocking `https://localhost.attacker.com` and cross-origin/cross-port hosts) + strict `application/json`. | Live smoke: cross-origin `403 CSRF_REJECTED`, spoofed loopback prefix `403`, `text/plain` & `form-urlencoded` `415`. | `VERIFIED PASS` |
| **SQL Injection & LIKE Wildcards** | Parameterized `node:sqlite` statements + `escapeLike()` (`ESCAPE '\'`). | Unit test (`escapeLike`) + Live `/api/v1/search?q=%25` & `/api/v1/cities?q=%25&page=abc` (`0` wildcard match leakage). | `VERIFIED PASS` |
| **CSV Formula Injection (CWE-1236)** | `sanitizeForCsv()` prepends `'` to leading whitespace + `[=+\-@\t\r]`. | Unit test (`8` payloads) + Live CSV export verified `@SUM(1,2)` -> `'@SUM(1,2)` and `-cmd...` -> `'-cmd...`. | `VERIFIED PASS` |
| **SSRF Protection** | `isSafeExternalHttpsUrl()` rejects HTTP, localhost, RFC1918, metadata `169.254.169.254`, IPv6 ULA/loopback, and credentials-in-URL. | Unit test across `16` blocked SSRF targets + `2` valid HTTPS endpoints. | `VERIFIED PASS` |
| **Log Secret Redaction** | `redactSensitiveString()` & `sanitizeLogContext()` redact `AIza*`, query secrets, Bearer tokens, passwords, and API keys before emitting JSON logs. | Unit test verified cleanly in [stage5Hardening.test.ts](file:///F:/SMART_GRID/tests/stage5Hardening.test.ts#L59-L74). | `VERIFIED PASS` |
| **Client Bundle Secret Hygiene** | `.next/static` scan across `46` JS/CSS files (`1,221,063` bytes). | **0 secrets leaked** (`GEMINI_API_KEY` & `OPENAI_API_KEY` hits confirmed as operator docs/UI labels only). | `VERIFIED PASS` |

---

## 5. AI Security, Quota Atomicity & Operational Safety

- **Header-Only Gemini Key (`STAGE4-P2-05a`):** [provider.ts](file:///F:/SMART_GRID/src/lib/ai/provider.ts) sends Gemini credentials strictly via the `x-goog-api-key` HTTP header rather than URL query strings, eliminating URL log leakage.
- **Scoped Alert Context (`STAGE4-P2-05c`):** `retrievePermittedContext()` filters `alerts` by `organization_id`, `city_id` (or city-agnostic `NULL`), and `division_code` (or `NULL`), verified via unit test in `tests/stage5Hardening.test.ts` so Tenant B / alternate cities / alternate divisions never see cross-scoped alerts.
- **Atomic Quota Reservation (`STAGE4-P2-05b`):** `ai_quota_reservations` uses atomic conditional `INSERT ... SELECT` reservation (`reserveAiQuotaSlot`), releases on provider/503 error (`releaseAiQuotaReservation`), and commits AI messages + `usage_records` inside one transaction (`commitAiTurnAndUsage`), preventing race overshoot and orphaned user turns on `503`.
- **Single-Node Rate Limiter Note:** `src/lib/auth/rateLimit.ts` uses an in-memory `Map` capped at `10,000` buckets with `60s` expiry pruning; multi-instance horizontal scaling requires a shared Redis rate limiter.
