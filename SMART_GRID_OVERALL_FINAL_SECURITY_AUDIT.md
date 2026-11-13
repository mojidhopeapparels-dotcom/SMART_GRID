# SMART GRID — OVERALL FINAL SECURITY AUDIT

**Audit Date:** `2026-11-13`  
**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem  
**Audit Scope:** Complete Application Security Verification (Sections 6.1–6.11)  
**Repository Root:** `F:\SMART_GRID`

---

## 1. Executive Security Summary

**Critical `P0` Findings:** **0**  
**Blocking `P1` Security/Config Conditions:** Production `.env` secrets & demo DB state (`OFA-P1-02`, `OFA-P1-03`), external webhook/TLS operational readiness (`OFA-P1-01`).  
**High-Priority `P2` Defense-in-Depth Gaps Discovered:**
1. **`OFA-P2-01` — Authenticated SSRF DNS-Rebinding / Non-Literal Hostname Gap** (`src/app/api/v1/integrations/route.ts`, `src/lib/security/sanitize.ts`).
2. **`OFA-P2-02` — Missing Rate Limit on `/api/v1/auth/mfa` Verification + Reverse-Proxy Dependency (`SMART_GRID_TRUST_PROXY`) for Auth IP Buckets**.
3. **`OFA-P2-04` — CSP `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`** (`next.config.mjs`).

Core security controls — authentication (`scrypt`), session revocation (`SHA-256` DB tokens, `HttpOnly`/`SameSite=lax`/conditional `Secure`), password-reset non-enumeration, CSRF (`Origin` + `Content-Type`), RBAC (`10` roles / `20` permissions), strict `organization_id` tenant isolation (`404` on cross-tenant GET/PATCH/DELETE/Export), SQL LIKE escaping, CWE-1236 CSV neutralization, and zero XSS sinks (`dangerouslySetInnerHTML`/`innerHTML`/`eval` absent) — are **`VERIFIED`** across source code, unit tests (`31/31`), and live production HTTP probes.

---

## 2. Detailed Security Domain Matrix (Sections 6.1–6.11)

### 6.1 Authentication & Account Lifecycle (`VERIFIED`)
- **Password Hashing:** Node `crypto.scrypt` with per-user random salt and `timingSafeEqual` (`src/lib/auth/password.ts`, `TEST-VERIFIED`).
- **Demo Mode Guard (`NODE_ENV=production` & `SMART_GRID_DEMO_MODE=false`):** Probed live in `task-2678`: attempting `POST /api/v1/auth/sign-in` with `admin@smartgrid.local` returned **HTTP `401 INVALID_CREDENTIALS`**; fresh smoke DB had **0 `@smartgrid.local` demo accounts**; `/sign-in` HTML contained zero demo passwords. Bootstrap admin (`usr_bootstrap_admin`) succeeded (`200 OK`) when explicitly supplied via `SMART_GRID_BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`.
- **Session Lifecycle:** Session tokens are hashed (`SHA-256`) before DB lookup (`sessions` table). Sign-out deletes/revokes session server-side (`live_smoke.mjs` verified `401` on reuse). Cookie attributes verified live:
  - Plain HTTP: `HttpOnly; SameSite=lax`
  - With `X-Forwarded-Proto: https` (probed `run_security_probe.mjs`): `Secure; HttpOnly; SameSite=lax`
- **Session Secret Handling (`ENVIRONMENT-DEPENDENT`):** If `SMART_GRID_SESSION_SECRET` (<32 chars or omitted) in production, `session.ts` generates a **per-process ephemeral random 32-byte key** rather than a predictable default — safe against forgery, **but invalidates all active sessions on restart/worker respawn** and fails `validateEnvironment()` (`configValid: false`, `OFA-P1-03`).
- **Password Reset Enumeration Protection (`VERIFIED`):** Probed live (`run_security_probe.mjs`) against known admin email vs `definitely-unknown-user-xyz@example.org`: both returned **HTTP `200`** with **identical JSON body** (`{ accepted: true, expiresInMinutes: 15, message: "...external SMTP/email relay integration is required..." }`). Expired/used tokens rejected cleanly (`password_reset_tokens` table, Migration 002).

### 6.2 Multi-Factor Authentication (`VERIFIED` / `CODE-VERIFIED` + Gap `OFA-P2-02`)
- **Enrollment & Lifecycle (`src/app/api/v1/auth/mfa/route.ts`, `src/lib/auth/{totp,mfaRecovery}.ts`):** Pending TOTP enrollment expires (`mfa_pending_enrollments`), TOTP uses SHA-1 30s (`+-1` window), sensitive changes (`enable`, `disable`, `regenerate_recovery`) require current-password verification. Recovery codes use `48-bit` entropy (`8` codes), salted/prefixed with `${userId}:` SHA-256 hash, strictly single-use (`verifyAndConsumeRecoveryCode`, verified `TEST-VERIFIED` against replay and cross-user use).
- **Finding (`OFA-P2-02`):** `POST /api/v1/auth/mfa` lacks `checkRateLimit()` around `currentPassword`, 6-digit TOTP, and recovery-code verification attempts (`P2` — requires an active session, blocking unauthenticated brute force, yet should enforce per-user/IP rate limits before broad rollout).

### 6.3 Authorization & RBAC (`VERIFIED` / `TEST-VERIFIED`)
- **10 System Roles / 20 Permissions (`src/lib/auth/rbac.ts`):** Roles (`SUPER_ADMIN`, `ORG_OWNER`, `CITY_ADMIN`, etc.) mapped deterministically to least-privilege permission sets. `VIEWER` lacks `sheets:write`, `operations:write`, `users:manage`, `billing:manage`.
- **Public Publishing Gate:** `canPublishPublicCity()` restricts `isPublic` city showcase creation strictly to `ORG_OWNER`, `SUPER_ADMIN`, `CITY_ADMIN` (`TEST-VERIFIED` and verified in `live_smoke.mjs` with `403` for non-publishers).

### 6.4 Multi-Tenant Isolation & IDOR Defense (`VERIFIED`)
Tested live across isolated Tenant A (`org_demo_global`) and dynamically registered Tenant B (`tenantb-sec@example.org`) in `run_security_probe.mjs` & `task-2678`:

| Cross-Tenant Attack Vector (Tenant B -> Tenant A) | Observed Result | Expected Policy | Status |
| --- | --- | --- | --- |
| `GET /api/v1/workbooks/wb_bca92437-362` | `404` | `404` (hide cross-tenant IDs) | `VERIFIED` |
| `PATCH /api/v1/workbooks/wb_bca92437-362` | `404` | `404` | `VERIFIED` |
| `DELETE /api/v1/workbooks/wb_bca92437-362` | `404` | `404` | `VERIFIED` |
| `GET /api/v1/workbooks/wb_bca92437-362/export?format=csv` | `404` | `404` | `VERIFIED` |
| `GET /api/v1/search?q=<Tenant A workbook title>` | `200` with `results: []` | Scoped zero leak | `VERIFIED` |
| `POST /api/v1/ai/chat` RAG retrieval (`organization_id`) | Returned strictly Tenant-A-permitted datasets only (`ds_toronto_flood` isolated) | Strict `organization_id` filter | `VERIFIED` & `TEST-VERIFIED` |
| Unauthorized city / invalid 1-digit division `POST` | `403` / `400` (`live_smoke.mjs`) | Reject cleanly | `VERIFIED` |

### 6.5 CSRF & Request Validation (`VERIFIED`)
- `assertMutationSecurity()` verified (`apiAndRbacIntegration.test.ts` + live HTTP `task-2678`):
  - Spoofed `Origin` (`https://evil.attacker.example`, `https://localhost.attacker.com`, cross-port `http://localhost:9999`) -> **HTTP `403 CSRF_REJECTED`**.
  - Wrong `Content-Type` (`application/x-www-form-urlencoded`, `text/plain`) -> **HTTP `415`**.
  - All mutations parse JSON defensively and validate payloads via Zod (`400 VALIDATION_ERROR`).

### 6.6 SSRF & External Requests (`VERIFIED` literal blocks / Gap `OFA-P2-01`)
- **Literal Target Protection (`VERIFIED`):** `isSafeExternalHttpsUrl()` (`src/lib/security/sanitize.ts`) tested across 16 blocked URLs (`apiAndRbacIntegration.test.ts`) and 4 live `POST /api/v1/integrations` probes (`run_ssrf_live.mjs`): `https://127.0.0.1:8443/hook`, `https://169.254.169.254/latest/meta-data`, `https://[::1]/hook`, and `http://api.example.com/unencrypted` all failed closed with **HTTP `400 UNSAFE_ENDPOINT_URL`**.
- **`TEST_CONNECTION` Execution Boundary (`src/app/api/v1/integrations/route.ts:209-217`):** Uses `HEAD`, `redirect: "error"`, AbortController timeout, and discards response body.
- **Finding (`OFA-P2-01`):** `isSafeExternalHttpsUrl` validates hostname syntax only and does **not** perform pre-connect `dns.lookup` IP pinning (`P2`). A public hostname resolving via DNS to RFC1918/loopback/metadata space bypasses literal filtering (`integrations:manage` privileged callers only).

### 6.7 SQL & Database Injection (`VERIFIED`)
- 100% of queries use `node:sqlite` prepared statements with positional `?` bindings; `escapeLike()` (`src/lib/security/sanitize.ts`) escapes `\`, `%`, `_` (`TEST-VERIFIED` & `live_smoke.mjs` verified on `/api/v1/search` and `/api/v1/cities`). Unbounded IDs/divisions rejected before SQL (`400`).

### 6.8 CSV & Spreadsheet Security (`VERIFIED`)
- `sanitizeForCsv()` (`src/lib/sheets/exportHelpers.ts`) prefixes leading `=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, leading-whitespace-then-formula triggers with `'`. Live CSV export check (`live_smoke.mjs`) confirmed `"@SUM(1,2)" -> "'@SUM(1,2)"` and `-cmd|' /C calc'!A0 -> '-cmd|' /C calc'!A0`.
- `MAX_SHEETS = 25` server-side enforced (`live_smoke.mjs` verified 25 permitted / 26th -> **HTTP `400 WORKBOOK_SHEET_LIMIT`**); `MAX_CELLS = 10_000`; `MAX_COLS = 52`; OLE2 legacy `.xls` magic (`D0 CF 11 E0`) rejected; JSON importer strips `__proto__`/`constructor`/`prototype` (`TEST-VERIFIED`).

### 6.9 HTTP Security Headers & CSP Assessment (`VERIFIED` + Nuances)
Observed verbatim from live `http://127.0.0.1:3210/api/v1/health` (`task-2678`):
- `content-security-policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- `x-frame-options`: `DENY`
- `x-content-type-options`: `nosniff`
- `referrer-policy`: `strict-origin-when-cross-origin`
- `permissions-policy`: `camera=(), microphone=(), geolocation=(self)`
- `x-powered-by`: `null` (suppressed via `poweredByHeader: false`)
- `strict-transport-security`: `null` on direct HTTP; `"max-age=31536000; includeSubDomains"` when `x-forwarded-proto: https` header is present. **Verified Next.js Build-Time Nuance (`OFA-P1-03`):** Setting `SMART_GRID_ENABLE_HSTS=true` or `NEXT_PUBLIC_APP_URL=https://...` *only* at `next start` runtime did NOT emit HSTS without `x-forwarded-proto: https` (`next.config.mjs` evaluates env vars at `next build` time).
- **CSP `'unsafe-inline'` Assessment (`OFA-P2-04`):** Currently needed by Next.js App Router runtime inline bootstrapping scripts & React inline `style={...}` props (`src/app/(public)/page.tsx`, etc.). Mitigated by **0 XSS sinks** (`dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` scan = `0` hits across `src/`). Long-term remediation: nonce-based Next.js middleware CSP.

### 6.10 Rate Limiting & Single-Instance Abuse Boundaries (`VERIFIED` / Gap `OFA-P2-02` & `OFA-P2-03`)
- `src/lib/auth/rateLimit.ts`: Sliding window in-process `Map`, bounded at `MAX_BUCKETS = 10_000`.
- Live probe (`run_security_probe.mjs`) confirmed `/api/v1/auth/sign-in` returned **10 x `401` followed by `429` on requests 11–12**.
- **Reverse-Proxy Bucket Collision Risk (`OFA-P2-02`):** `resolveClientIpFromHeaders()` ignores `X-Forwarded-For` unless `SMART_GRID_TRUST_PROXY=true`. If deployed behind a proxy without that flag set, all users share `"direct-unproxied"`, allowing a single attacker to lock out all sign-ins (`10` failures/15m).
- **Multi-Instance Limitation (`OFA-P2-03`):** Bucket map clears on restart and is unshared across multiple Node processes; Redis/shared store is required prior to multi-instance horizontal scaling. Also `/api/v1/ai/chat` relies solely on monthly org quota (no per-minute burst limit).

### 6.11 Secret Management (`VERIFIED`)
- Zero `.env*` secret files tracked; zero leaked admin passwords/session secrets in server stdout/stderr (`task-2678`: `serverLogsContainAdminPassword: false`, `serverLogsContainSessionSecret: false`).
- Client static chunk scan (`scan_next.mjs` across all `45` JS chunks in `.next/static`): **0 credential/API-key values leaked** (only 3 instructional documentation literals mentioning `GEMINI_API_KEY` / `OPENAI_API_KEY`).
