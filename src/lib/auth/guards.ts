import net from "node:net";
import { getDb } from "../db";
import { isTrustedProxyEnabled } from "../config/env";
import { DIVISIONS } from "../domain/divisions";
import { apiError } from "../domain/statuses";

/**
 * Validates request origin and Content-Type for state-changing operations.
 * Protects against cross-origin form submissions, subdomain-prefix loopback spoofing, and content-type bypasses.
 */
export function assertMutationSecurity(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const reqUrl = new URL(req.url);
      const hostHeader =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        reqUrl.host;
      const originHost = originUrl.host;
      const parseHostPort = (h: string): { hostname: string; port: string } | null => {
        try {
          const u = new URL(`http://${h}`);
          return { hostname: u.hostname.toLowerCase(), port: u.port };
        } catch {
          return null;
        }
      };
      const isLoopbackHost = (hostname: string) =>
        hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
      const oParsed = { hostname: originUrl.hostname.toLowerCase(), port: originUrl.port };
      const hParsed = parseHostPort(hostHeader);
      const rParsed = parseHostPort(reqUrl.host);
      const loopbackMatch =
        isLoopbackHost(oParsed.hostname) &&
        ((hParsed !== null && isLoopbackHost(hParsed.hostname) && oParsed.port === hParsed.port) ||
          (rParsed !== null && isLoopbackHost(rParsed.hostname) && oParsed.port === rParsed.port));
      const hostsMatch =
        originHost === hostHeader ||
        originHost === reqUrl.host ||
        loopbackMatch;

      if (!hostsMatch) {
        return apiError(
          "CSRF_REJECTED",
          "Cross-origin state mutations are rejected.",
          403
        );
      }
    } catch {
      return apiError("CSRF_REJECTED", "Malformed origin header.", 403);
    }
  }

  const method = req.method.toUpperCase();
  if (["POST", "PATCH", "PUT"].includes(method)) {
    const contentType = req.headers.get("content-type") || "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("multipart/form-data")
    ) {
      return apiError(
        "UNSUPPORTED_MEDIA_TYPE",
        "Mutating requests must use application/json or multipart/form-data.",
        415
      );
    }
  }
  return null;
}

/**
 * Verifies that a cityId exists and either belongs to the tenant or is marked public.
 */
export function assertPermittedCity(
  db: ReturnType<typeof getDb>,
  cityId: string | null | undefined,
  organizationId: string
): boolean {
  if (!cityId) return true;
  const row = db
    .prepare(
      "SELECT id FROM cities WHERE id = ? AND (organization_id = ? OR is_public = 1)"
    )
    .get(cityId, organizationId);
  return Boolean(row);
}

/**
 * Verifies that a division code matches one of the 24 canonical 2-digit intelligence division codes.
 */
export function assertValidDivision(divisionCode: string | null | undefined): boolean {
  if (!divisionCode) return true;
  return DIVISIONS.some((d) => d.code === divisionCode);
}

/**
 * Verifies that an asset belongs to the caller's organization.
 */
export function assertTenantAsset(
  db: ReturnType<typeof getDb>,
  assetId: string | null | undefined,
  organizationId: string
): boolean {
  if (!assetId) return true;
  const row = db
    .prepare("SELECT id FROM assets WHERE id = ? AND organization_id = ?")
    .get(assetId, organizationId);
  return Boolean(row);
}

/**
 * Extracts validated client IP ONLY when SMART_GRID_TRUST_PROXY=true.
 */
export function resolveClientIpFromHeaders(headerLookup: {
  get(name: string): string | null | undefined;
}): string {
  if (!isTrustedProxyEnabled()) {
    return "direct-unproxied";
  }

  const forwarded = headerLookup.get("x-forwarded-for");
  if (forwarded) {
    const candidates = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const candidate of candidates) {
      if (net.isIP(candidate) !== 0) {
        return candidate;
      }
    }
  }

  const realIp = headerLookup.get("x-real-ip")?.trim();
  if (realIp && net.isIP(realIp) !== 0) {
    return realIp;
  }

  return "127.0.0.1";
}
