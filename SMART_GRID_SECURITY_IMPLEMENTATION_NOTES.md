# SMART GRID — SECURITY IMPLEMENTATION NOTES

**Scope:** Authentication, Session Management, RBAC, Multi-Tenant Isolation, Spreadsheet Safety, AI Grounding & Injection Defense, HTTP Hardening.

---

## 1. Password Storage & Verification (`src/lib/auth/password.ts`)
- Algorithm: Node.js `crypto.scryptSync` (`KEY_LEN = 64`) with a per-user 16-byte cryptographic random salt (`scrypt:<saltHex>:<derivedHex>`).
- Verification: `verifyPassword` compares derived buffers using `crypto.timingSafeEqual`.
- API Key Hashing: `sha256Hex` stores only SHA-256 digests (`key_hash`) in `api_keys`; plaintext keys (`sg_live_...`) are returned once on creation (`src/app/api/v1/admin/route.ts`).

## 2. Two-Factor Authentication — TOTP MFA (`src/lib/auth/totp.ts`, `src/app/api/v1/auth/mfa/route.ts`)
- Implements RFC 6238 HMAC-SHA1 6-digit TOTP with 30-second steps and `±1` step verification window (`verifyTotpCode`) using `crypto.timingSafeEqual`.
- Secrets are Base32-encoded 20-byte random keys and verified before enabling/disabling `mfa_enabled` on a user record.
- Sign-in (`src/app/api/v1/auth/sign-in/route.ts`) checks `mfa_enabled`; when active, requires a valid `totpCode` before issuing a session cookie.

## 3. Session Architecture (`src/lib/auth/session.ts`)
- Cookie Name: `sg_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV === "production"`).
- Token Integrity: Opaque 32-byte random token signed with HMAC-SHA256 (`SMART_GRID_SESSION_SECRET` env var; fallback development string strictly flagged for non-production replacement).
- Server Persistence: Stores only `sha256Hex(rawToken)` in the `sessions` table with 7-day TTL (`SESSION_TTL_HOURS = 168`), plus `active_organization_id` and `active_city_id`.

## 4. Server-Side RBAC & Tenant Isolation (`src/lib/auth/rbac.ts`, API Routes)
- `requireAuth(requiredPermission?)` validates the signed cookie against active `sessions`, resolves the active membership's `role_code`, computes permissions via `getRolePermissions`, and enforces `hasPermission` server-side before returning data or mutating state.
- System Roles: `SUPER_ADMIN`, `ORG_OWNER`, `ORG_ADMIN`, `CITY_ADMIN`, `DIVISION_MANAGER`, `DATA_ANALYST`, and `VIEWER` across 20 fine-grained permission scopes (`org:manage`, `users:manage`, `billing:manage`, `developer:manage`, `audit:read`, `sheets:write`, `operations:write`, `workflows:approve`, `ai:use`, etc.).
- Tenant Isolation: Every enterprise query and mutation scopes SQL predicates with `WHERE organization_id = ?` bound to `auth.ctx.organizationId`. Public routes (`src/app/(public)/*`) never query tenant-private records.

## 5. Spreadsheet Formula Security (`src/lib/sheets/formulaEngine.ts`)
- Formulas are parsed and evaluated by a bounded tokenizer and recursive-descent parser without `eval()`, `new Function()`, or dynamic code execution.
- Circular dependency chains fail safely with `#CIRC!`; division by zero returns `#DIV/0!`; unrecognized identifiers/functions return `#NAME?`.

## 6. AI Grounding & Prompt Injection Defense (`src/lib/ai/provider.ts`)
- `retrievePermittedContext` executes SQL queries strictly scoped by `organization_id` after `requireAuth("ai:use")`.
- Untrusted municipal records are wrapped inside `<UNTRUSTED_CITY_DATA> ... </UNTRUSTED_CITY_DATA>` delimiters with explicit system instruction boundaries treating city records strictly as data.
- External Webhook Validation (`src/app/api/v1/admin/route.ts`): Enforces `https://` protocol on registered webhook target URLs.

## 7. Security Headers & Rate Limiting (`next.config.ts`, `src/lib/auth/rateLimit.ts`)
- `poweredByHeader: false` disables `X-Powered-By`.
- Global response headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.
- Auth & Public Enquiry routes apply in-memory sliding-window rate limiting via `checkRateLimit`. (Production clustered deployments should back rate limiting with Redis.)

## 8. Audit Logging (`src/lib/auth/audit.ts`, `/app/security`)
- Security-sensitive operations (sign-in, sign-up, MFA enable/disable, user invite, API key create/revoke, webhook creation, billing tier update, workflow approval, report/sheet writes) write structured entries to `audit_logs` scoped to `organization_id`.
