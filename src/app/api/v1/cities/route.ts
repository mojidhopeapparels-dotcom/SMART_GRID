import crypto from "node:crypto";
import { z } from "zod";
import { getDb, normalizeRows, withTransaction } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { getAuthContext, requireAuth, assertMutationSecurity } from "@/lib/auth/session";
import { canPublishPublicCity } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError, apiPaginated, apiSuccess } from "@/lib/domain/statuses";
import { escapeLike } from "@/lib/security/sanitize";

const CreateCitySchema = z.object({
  name: z.string().min(2).max(120),
  localName: z.string().max(120).optional(),
  countryCode: z.string().min(2).max(3),
  regionName: z.string().min(2).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(2).max(80).default("UTC"),
  currency: z.string().min(3).max(5).default("USD"),
  population: z.number().int().nonnegative().optional(),
  areaKm2: z.number().positive().optional(),
  summary: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
});

export async function GET(req: Request) {
  ensureSeeded();
  const ctx = await getAuthContext();
  const db = getDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const rawPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const rawPageSize = Number.parseInt(url.searchParams.get("pageSize") || "25", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(100, rawPageSize) : 25;
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const params: (string | number)[] = [];

  if (ctx) {
    whereParts.push("(c.organization_id = ? OR c.is_public = 1)");
    params.push(ctx.organizationId);
  } else {
    whereParts.push("c.is_public = 1");
  }

  if (q) {
    whereParts.push(
      "(LOWER(c.name) LIKE ? ESCAPE '\\' OR LOWER(c.region_name) LIKE ? ESCAPE '\\' OR LOWER(co.name) LIKE ? ESCAPE '\\')"
    );
    const like = `%${escapeLike(q.toLowerCase())}%`;
    params.push(like, like, like);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM cities c LEFT JOIN countries co ON co.code = c.country_code ${whereSql}`
    )
    .get(...params) as { cnt: number };

  const rows = normalizeRows(
    db
      .prepare(
        `SELECT c.*, co.name AS country_name, co.region_group
         FROM cities c
         LEFT JOIN countries co ON co.code = c.country_code
         ${whereSql}
         ORDER BY c.name ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset)
  );

  return apiPaginated(rows, page, pageSize, totalRow.cnt);
}

export async function POST(req: Request) {
  ensureSeeded();
  const secErr = assertMutationSecurity(req);
  if (secErr) return secErr;

  const auth = await requireAuth("cities:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
  }

  const parsed = CreateCitySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid city fields.", 400, parsed.error.flatten());
  }

  if (parsed.data.isPublic && !canPublishPublicCity(auth.ctx.permissions)) {
    writeAuditLog({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
      action: "CITY_PUBLIC_PUBLISH_DENIED",
      resourceType: "CITY",
      outcome: "DENIED",
      details: { roleCode: auth.ctx.roleCode, name: parsed.data.name },
    });
    return apiError(
      "FORBIDDEN",
      "Publishing a city to the public directory requires reports:publish or users:manage permission.",
      403
    );
  }

  const db = getDb();
  const now = new Date().toISOString();
  const id = `city_${crypto.randomUUID().slice(0, 12)}`;
  const slugBase = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase}-${crypto.randomBytes(2).toString("hex")}`;

  const box = [
    [parsed.data.longitude - 0.1, parsed.data.latitude - 0.08],
    [parsed.data.longitude + 0.1, parsed.data.latitude - 0.08],
    [parsed.data.longitude + 0.1, parsed.data.latitude + 0.08],
    [parsed.data.longitude - 0.1, parsed.data.latitude + 0.08],
    [parsed.data.longitude - 0.1, parsed.data.latitude - 0.08],
  ];

  withTransaction((tx) => {
    tx.prepare(
      "INSERT OR IGNORE INTO countries (code, name, region_group, default_currency, default_timezone) VALUES (?, ?, 'Global', ?, ?)"
    ).run(
      parsed.data.countryCode.toUpperCase(),
      parsed.data.countryCode.toUpperCase(),
      parsed.data.currency,
      parsed.data.timezone
    );

    tx.prepare(
      `INSERT INTO cities (
        id, organization_id, slug, name, local_name, country_code, region_name,
        latitude, longitude, timezone, currency, population, population_source,
        area_km2, readiness_score, data_status, is_public, boundary_geojson, summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Organization submission', ?, 25, 'INTEGRATION_REQUIRED', ?, ?, ?, ?, ?)`
    ).run(
      id,
      auth.ctx.organizationId,
      slug,
      parsed.data.name.trim(),
      parsed.data.localName ?? null,
      parsed.data.countryCode.toUpperCase(),
      parsed.data.regionName.trim(),
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.timezone,
      parsed.data.currency,
      parsed.data.population ?? null,
      parsed.data.areaKm2 ?? null,
      parsed.data.isPublic ? 1 : 0,
      JSON.stringify({
        type: "Feature",
        properties: { name: `${parsed.data.name} Approximate Bounding Box`, simulated: true },
        geometry: { type: "Polygon", coordinates: [box] },
      }),
      parsed.data.summary ?? "Registered city profile awaiting data source connectors.",
      now,
      now
    );
  });

  writeAuditLog({
    organizationId: auth.ctx.organizationId,
    userId: auth.ctx.userId,
    action: "CITY_REGISTERED",
    resourceType: "CITY",
    resourceId: id,
  });

  return apiSuccess({ id, slug, name: parsed.data.name }, undefined, 201);
}
