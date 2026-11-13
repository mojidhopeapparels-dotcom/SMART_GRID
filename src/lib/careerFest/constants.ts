/**
 * Shared Career Fest 2026 showcase constants, limits, and isolated seed identifiers.
 * Intentionally kept browser-safe (no node:* imports) so both server routes and client UI share them.
 */

export const CAREER_FEST_ROLE_CODE = "CAREER_FEST_VISITOR";
export const CAREER_FEST_ORG_ID = "org_career_fest_demo";
export const CAREER_FEST_ORG_SLUG = "career-fest-2026";
export const CAREER_FEST_USER_ID = "usr_career_fest_visitor";
export const CAREER_FEST_USER_EMAIL = "visitor-sandbox@careerfest.smartgrid.invalid";
export const CAREER_FEST_WORKSPACE_ID = "ws_career_fest_2026";
export const CAREER_FEST_STARTER_WORKBOOK_ID = "wb_cf_starter";

export const CAREER_FEST_SESSION_TTL_SECONDS = 30 * 60; // Strict 30-minute session lifetime
export const CAREER_FEST_SESSION_TTL_MS = CAREER_FEST_SESSION_TTL_SECONDS * 1000;
export const CAREER_FEST_WARNING_THRESHOLD_SECONDS = 5 * 60;

export const CAREER_FEST_MAX_AI_TURNS_PER_SESSION = 12;
export const CAREER_FEST_MAX_WORKBOOKS_PER_SESSION = 8;

export const CAREER_FEST_APPROVED_PERMISSIONS: readonly string[] = [
  "cities:read",
  "divisions:read",
  "data:read",
  "data:export",
  "operations:read",
  "sheets:read",
  "sheets:write",
  "ai:use",
  "reports:read",
];
