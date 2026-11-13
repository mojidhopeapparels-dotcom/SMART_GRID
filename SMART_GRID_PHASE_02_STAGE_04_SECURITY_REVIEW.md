# SMART GRID — PHASE 02, STAGE 04: SECURITY, AUTHENTICATION & MULTI-TENANCY REVIEW

**Project:** SMART GRID  
**Stage:** Phase 02, Stage 4 — Independent Quality Review  
**Scope:** Authentication, scrypt password storage, TOTP MFA, session management, RBAC, CSRF, SSRF, XSS, SQL injection, tenant isolation, HTTP security headers, bundle secret hygiene, and dependency CVEs  
**Verification Date:** 2026-11-13  

---

## 1. Executive Security Summary

Direct code inspection and live penetration smoke testing confirm that SMART GRID enforces robust baseline security controls: salted `crypto.scryptSync` password hashing with `timingSafeEqual`, opaque HTTP-only cookie tokens hashed with SHA-256 in SQLite, transactional session revocation, strict server-side RBAC on every `/api/v1/*` mutation, strict Origin/Host equality CSRF checks blocking `text/plain` and `application/x-www-form-urlencoded`, comprehensive IPv4/IPv6 SSRF filtering on webhook registration, escaped SQL `LIKE` queries, and verified cross-tenant IDOR isolation (`404`/`403` across tenant boundaries).

However, Stage 4 empirical checks uncovered **1 High-severity (`P1`) dependency vulnerability** (`xlsx` / SheetJS with no npm upstream fix) and **5 Medium (`P2`) security hardening gaps** that must be prioritized during Stage 5 Production Preparation.

**Overall Security Posture:** **CONDITIONALLY SOUND (No P0 Breaches; 1 P1 Dependency CVE + 5 P2 Hardening Items Identified)**

---

## 2. Independent Control Verification Matrix

| Control Area | Implementation Inspected | Verification Result | Source Evidence |
|---|---|---|---|
| **Password Hashing** | `crypto.scryptSync(password, salt, 64)` (`scrypt:${salt}:${derived}`) + `crypto.timingSafeEqual` *(Note: Stage 2 docs previously misstated PBKDF2-SHA512; actual implementation is scrypt)* | **PASS** | `src/lib/auth/password.ts`, `tests/securityAndTenant.test.ts` |
| **Session Cookies** | `sg_session` (`httpOnly: true`, `sameSite: "lax"`, `TTL = 168h`), SHA-256 token hash stored in `sessions`, immediate DB deletion on `sign-out` verified live (`401` on reuse) | **PASS** | `src/lib/auth/session.ts`, `src/app/api/v1/auth/sign-out/route.ts`, `tests/live_smoke.mjs` |
| **CSRF Defense** | `assertMutationSecurity()` checks origin hostname+port equality (loopback-safe without prefix bugs), rejects non-JSON mutating requests (`text/plain`, `application/x-www-form-urlencoded` -> `415`) | **PASS** | `src/lib/auth/guards.ts`, `EnterpriseShell.tsx`, `tests/live_smoke.mjs` |
| **SSRF Protection** | `isSafeExternalHttpsUrl()` requires `https:`, rejects credentials, `.local`/`.internal`, loopback/private/carrier-grade NAT IPv4, IPv6 ULA/loopback/mapped-IPv4, integer IPs | **PASS** | `src/lib/security/sanitize.ts`, `src/app/api/v1/admin/route.ts`, `tests/apiAndRbacIntegration.test.ts` |
| **Bundle Credential Safety** | `/sign-in` renders demo presets dynamically in Server Component (suppressed when `NODE_ENV=production`); `.next/static` scan across `97` files found **0 demo password strings**; live `/sign-in` HTML check confirmed clean | **PASS** | `src/app/sign-in/page.tsx`, `.next/static` scan, `tests/live_smoke.mjs` |
| **Cross-Tenant IDOR** | All 28 `/app/` server pages & API handlers filter by `organization_id = ?`; live HTTP check with Tenant B cookie returned **`404`** on Tenant A workbook GET/PATCH/DELETE/export | **PASS** | `src/app/app/` query scan, Stage 4 live probe |
| **SQL Injection & LIKE Escaping** | All SQLite `.prepare(...)` queries use positional `?` parameters; `/search` and `/cities` apply `escapeLike()` with `ESCAPE '\'` | **PASS** | `src/app/api/v1/search/route.ts`, `cities/route.ts`, `tests/live_smoke.mjs` |
| **XSS / CSV Injection** | Zero `dangerouslySetInnerHTML` / `innerHTML` sinks in `src/`; `sanitizeForCsv()` neutralizes `=`, `+`, `-`, `@`, `\t`, `\r` including leading whitespace (verified live on CSV export) | **PASS** | Source AST scan, `src/lib/sheets/exportHelpers.ts`, `tests/sheetsExport.test.ts` |
| **HTTP Security Headers** | Live `/` returned `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Powered-By` stripped. **Missing `CSP` and `HSTS`** | **PARTIAL** | `next.config.mjs:7-29`, Stage 4 live header probe |

---

## 3. Confirmed Stage 4 Security & Dependency Findings

| ID | Severity | Area | Exact Location | Issue & Security Impact | Remediation Recommendation |
|---|---|---|---|---|---|
| `STAGE4-P1-01` | **P1 (High)** | Dependencies (`xlsx`) | `package.json`, `SheetsWorkspaceClient.tsx:4,294`, `workbooks/[id]/export/route.ts:1` | `npm audit --json` reports **High-severity Prototype Pollution & ReDoS** in npm `xlsx` (`sheetjs`, **`fixAvailable: false`**). Furthermore, `SheetsWorkspaceClient.tsx` passes untrusted user-uploaded `.xlsx`/`.xls` files directly to `XLSX.read(buf, { type: "array" })`. | Migrate XLSX generation/parsing to an actively patched library (e.g., `exceljs`) or isolated Web Worker/sandboxed parser; remove legacy `xlsx` npm package before public GA. |
| `STAGE4-P2-01` | **P2 (Medium)** | Headers & `next` CVEs | `next.config.mjs:7-29`, `package.json` (`next@15.5.29`) | Omits `Content-Security-Policy` (weakening defense-in-depth against stored/reflected XSS or framing) and `Strict-Transport-Security`. Also `npm audit` flags `postcss <=8.5.22` (moderate/high) via `next@15.5.29` (fix requires `next@16.4.6`). | Add strict CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) and HSTS; evaluate Next.js security upgrade path in Stage 5. |
| `STAGE4-P2-02` | **P2 (Medium)** | Auth Lifecycle & Rate Limit Spoofing | `session.ts:271`, `auth/mfa/route.ts:35-89`, `src/app/api/v1/auth/` | (1) `getClientIp()` trusts client-supplied `X-Forwarded-For` blindly, allowing callers to spoof IPs to bypass per-IP rate limits on `sign-up`, `public/enquiries`, and `sign-in` (though `sign-in` also throttles by email). (2) `mfa/route.ts` `enable` and `disable` do not re-verify the user's current password, and `setup` issues stateless secrets without server-side pending verification. (3) No password reset, self-service password change, or MFA backup recovery codes exist. | Gate `X-Forwarded-For` behind an explicit `TRUSTED_PROXY` setting; require current password on MFA enable/disable + store pending MFA secret server-side; add password rotation/reset and recovery codes prior to broad customer onboarding. |
| `STAGE4-P2-03` | **P2 (Medium)** | Existing DB Hygiene | `data/smart_grid.db`, `src/lib/db/seed.ts:106-140` | Although `seed.ts` omits demo users when starting cleanly in `NODE_ENV=production` (verified on `.tmp_s4_smoke.db`: 0 `@smartgrid.local` users), the existing repository database `data/smart_grid.db` already has the 4 active demo accounts (`users: 4`). Reusing that DB file in production exposes known demo credentials. | Never ship `data/smart_grid.db` to production; document/enforce fresh database provisioning with `SMART_GRID_BOOTSTRAP_ADMIN_*` in Stage 5 deployment checklists. |
| `STAGE4-P2-04` | **P2 (Medium)** | Public Exposure Permission | `src/app/api/v1/cities/route.ts:22,85,148` | `POST /api/v1/cities` requires only `"cities:write"` while accepting `isPublic: true` (`is_public = 1`), allowing lower-privilege writers to publish cities visible to all tenants and the unauthenticated public site without `reports:publish` or `ORG_OWNER` sign-off. | Restrict `isPublic: true` mutations to callers holding `"reports:publish"` or `"users:manage"` (role-gated approval). |
| `STAGE4-P2-05a` | **P2 (Medium)** | Secret Handling in AI Call | `src/lib/ai/provider.ts:202` | Gemini REST fetch passes `GEMINI_API_KEY` in URL query string (`?key=${encodeURIComponent(apiKey)}`), creating risk of credential leakage in outbound proxy logs, APM traces, or error dumps. | Move key transmission to the `x-goog-api-key` HTTP request header per Google Gemini REST API best practices. |

---

## 4. Security Verification Verdict

Core multi-tenant isolation, authentication cryptography, CSRF, SSRF, and SQLi protections are verified strong. Stage 5 Production Preparation **MUST** resolve `STAGE4-P1-01` (or enforce strict CSV-only/size-bounded mitigation if `xlsx` swap is staged), add CSP/HSTS headers, fix Gemini key header placement, and enforce fresh DB provisioning without seeded demo users.
