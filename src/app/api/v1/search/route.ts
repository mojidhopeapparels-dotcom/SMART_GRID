import { getDb, normalizeRows } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { requireAuth } from "@/lib/auth/session";
import { DIVISIONS } from "@/lib/domain/divisions";
import { apiSuccess } from "@/lib/domain/statuses";
import { escapeLike } from "@/lib/security/sanitize";

export async function GET(req: Request) {
  ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) {
    return apiSuccess({ results: [] });
  }

  const like = `%${escapeLike(q)}%`;
  const orgId = auth.ctx.organizationId;
  const db = getDb();

  const results: { type: string; id: string; title: string; subtitle: string; href: string }[] = [];

  for (const d of DIVISIONS) {
    if (d.name.toLowerCase().includes(q) || d.code.includes(q) || d.purpose.toLowerCase().includes(q)) {
      results.push({
        type: "Division",
        id: d.code,
        title: `Division ${d.code}: ${d.name}`,
        subtitle: d.purpose,
        href: `/app/divisions/${d.slug}`,
      });
    }
  }

  const cities = normalizeRows<{ id: string; slug: string; name: string; region_name: string }>(
    db
      .prepare(
        "SELECT id, slug, name, region_name FROM cities WHERE (organization_id = ? OR is_public = 1) AND (LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(region_name) LIKE ? ESCAPE '\\') LIMIT 8"
      )
      .all(orgId, like, like)
  );
  for (const c of cities) {
    results.push({ type: "City", id: c.id, title: c.name, subtitle: c.region_name, href: `/app/cities/${c.slug}` });
  }

  const datasets = normalizeRows<{ id: string; name: string; data_status: string }>(
    db
      .prepare("SELECT id, name, data_status FROM datasets WHERE organization_id = ? AND (LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\') LIMIT 8")
      .all(orgId, like, like)
  );
  for (const ds of datasets) {
    results.push({ type: "Dataset", id: ds.id, title: ds.name, subtitle: `Status: ${ds.data_status}`, href: "/app/data-catalog" });
  }

  const workbooks = auth.ctx.isCareerFestVisitor
    ? normalizeRows<{ id: string; title: string }>(
        db
          .prepare(
            "SELECT id, title FROM workbooks WHERE organization_id = ? AND is_archived = 0 AND (owner_session_id IS NULL OR owner_session_id = ?) AND LOWER(title) LIKE ? ESCAPE '\\' LIMIT 8"
          )
          .all(orgId, auth.ctx.sessionId, like)
      )
    : normalizeRows<{ id: string; title: string }>(
        db
          .prepare("SELECT id, title FROM workbooks WHERE organization_id = ? AND is_archived = 0 AND LOWER(title) LIKE ? ESCAPE '\\' LIMIT 8")
          .all(orgId, like)
      );
  for (const w of workbooks) {
    results.push({ type: "Workbook", id: w.id, title: w.title, subtitle: "SMART GRID SHEETS", href: `/app/sheets?id=${w.id}` });
  }

  const assets = normalizeRows<{ id: string; name: string; asset_tag: string }>(
    db
      .prepare("SELECT id, name, asset_tag FROM assets WHERE organization_id = ? AND (LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(asset_tag) LIKE ? ESCAPE '\\') LIMIT 8")
      .all(orgId, like, like)
  );
  for (const a of assets) {
    results.push({ type: "Asset", id: a.id, title: a.name, subtitle: a.asset_tag, href: "/app/operations" });
  }

  const reports = normalizeRows<{ id: string; title: string; status: string }>(
    db
      .prepare("SELECT id, title, status FROM reports WHERE organization_id = ? AND LOWER(title) LIKE ? ESCAPE '\\' LIMIT 8")
      .all(orgId, like)
  );
  for (const r of reports) {
    results.push({ type: "Report", id: r.id, title: r.title, subtitle: `Status: ${r.status}`, href: "/app/reports" });
  }

  return apiSuccess({ results: results.slice(0, 30) });
}
