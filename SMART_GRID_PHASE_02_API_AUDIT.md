# SMART GRID — PHASE 02 API AUDIT & ENDPOINT RESILIENCE
**Document Version:** 2.0.0  
**Audit Standard:** RESTful Specification, HTTP Status Integrity, Payload Validation, Rate Limiting & Origin Security  
**Date:** 2026-11-12  
**Target Repository:** `F:\SMART_GRID`  

---

## 1. API Route Coverage & Inventory

SMART GRID implements 19 dedicated Next.js App Router API route handlers under `/api/v1/`:

| Endpoint Path | Methods Verified | Auth Scope | Primary Function |
|---|---|---|---|
| `/api/v1/health` | GET | Public | Database connectivity, division index count & AI status |
| `/api/v1/auth/sign-in` | POST | Public (Rate-Limited) | Password + TOTP MFA authentication |
| `/api/v1/auth/sign-up` | POST | Public (Rate-Limited) | Organization registration & starter subscription |
| `/api/v1/auth/sign-out` | POST | Authenticated | Session invalidation & audit log recording |
| `/api/v1/auth/session` | GET, PATCH | Authenticated | Current identity retrieval & organization context switching |
| `/api/v1/auth/mfa` | POST | Authenticated | TOTP MFA setup, verification, and disabling |
| `/api/v1/public/enquiries` | POST | Public (Rate-Limited) | Contact & partnership submissions with honeypot guard |
| `/api/v1/divisions` | GET | Public | Retrieval of all 24 canonical intelligence divisions |
| `/api/v1/cities` | GET, POST | Authenticated (`cities:write`) | City network queries & municipal profile creation |
| `/api/v1/datasets` | GET, POST, PATCH | Authenticated (`data:write`, `reports:publish`) | Data catalog queries, observation ingestion & publication |
| `/api/v1/integrations` | GET, POST, PATCH | Authenticated (`integrations:manage`) | Data source connectors, SSRF checks & status tests |
| `/api/v1/workbooks` | GET, POST | Authenticated (`sheets:read`, `sheets:write`) | Workbook list & creation with initial sheet grid |
| `/api/v1/workbooks/[id]` | GET, PATCH, DELETE | Authenticated (`sheets:read`, `sheets:write`) | Sheet cell persistence, version snapshotting, archiving |
| `/api/v1/workbooks/[id]/export` | GET | Authenticated (`data:export`) | Formula-neutralized CSV, multi-sheet XLSX, and JSON export |
| `/api/v1/ai/chat` | GET, POST | Authenticated (`ai:use`) | Quota-governed AI completions with permitted retrieval |
| `/api/v1/ai/sessions` | GET, DELETE | Authenticated (`ai:use`) | AI conversation session inspection & deletion |
| `/api/v1/operations` | GET, POST, PATCH | Authenticated (`operations:write`, etc.) | Assets, work orders, incidents, reports, workflows |
| `/api/v1/admin` | GET, POST | Authenticated (`users:manage`, `billing:manage`) | Member invitation, API keys, webhooks, plans |
| `/api/v1/search` | GET | Authenticated | Escaped SQL LIKE full-text search across 6 subsystems |

---

## 2. Security & Defense Hardening (Phase 02 Enhancements)

1. **Origin Verification & CSRF Rejection (`assertMutationSecurity`):**
   - Every mutating route (`POST`, `PATCH`, `DELETE`) verifies that request `Origin` matches the host, rejecting cross-site forgery attempts with HTTP 403 `CSRF_REJECTED`.
2. **Content-Type Strictness:**
   - JSON mutation endpoints reject requests lacking `application/json` or `multipart/form-data` with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
3. **Cross-Tenant IDOR Protection:**
   - Mutation payloads specifying `cityId`, `divisionCode`, or `assetId` are rigorously verified against tenant membership and public status before database operations.
4. **Quota Governance & Truthful Billing (BUG-07):**
   - The AI endpoint enforces monthly quotas (`subscriptions.ai_monthly_quota`). When consumed, requests return HTTP 429 `AI_QUOTA_EXCEEDED`. Usage records are only created upon verified completion (`aiResult.ok === true`).
5. **AI Session Deletion (BUG-08):**
   - Added `DELETE /api/v1/ai/sessions?sessionId=...` with tenant/user ownership verification.
6. **SQL LIKE Wildcard Sanitization (BUG-11):**
   - Search parameters escape `%` and `_` with `ESCAPE '\'`.
