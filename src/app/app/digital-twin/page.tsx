import { getDb, normalizeRows } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/session";
import { DigitalTwinClient } from "@/components/enterprise/DigitalTwinClient";

export const dynamic = "force-dynamic";

export default async function DigitalTwinPage() {
  const ctx = await requirePageAuth();
  const db = getDb();
  const orgId = ctx.organizationId;

  const cities = normalizeRows<{ id: string; name: string; latitude: number; longitude: number; data_status: string }>(
    db
      .prepare("SELECT id, name, latitude, longitude, data_status FROM cities WHERE organization_id = ? OR is_public = 1")
      .all(orgId)
  );
  const assets = normalizeRows<{ id: string; name: string; division_code: string; latitude: number | null; longitude: number | null; data_status: string }>(
    db.prepare("SELECT id, name, division_code, latitude, longitude, data_status FROM assets WHERE organization_id = ?").all(orgId)
  );
  const sensors = normalizeRows<{ id: string; name: string; division_code: string; latitude: number | null; longitude: number | null; data_status: string }>(
    db.prepare("SELECT id, name, division_code, latitude, longitude, data_status FROM sensors WHERE organization_id = ?").all(orgId)
  );
  const layers = normalizeRows<{ id: string; name: string; layer_type: string; crs: string; data_status: string; source_name: string }>(
    db.prepare("SELECT id, name, layer_type, crs, data_status, source_name FROM gis_layers WHERE organization_id = ?").all(orgId)
  );

  const points = [
    ...cities.map((c) => ({
      id: c.id,
      name: c.name,
      kind: "CITY" as const,
      latitude: c.latitude,
      longitude: c.longitude,
      status: c.data_status,
    })),
    ...assets
      .filter((a) => a.latitude !== null && a.longitude !== null)
      .map((a) => ({
        id: a.id,
        name: a.name,
        kind: "ASSET" as const,
        divisionCode: a.division_code,
        latitude: a.latitude!,
        longitude: a.longitude!,
        status: a.data_status,
      })),
    ...sensors
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "SENSOR" as const,
        divisionCode: s.division_code,
        latitude: s.latitude!,
        longitude: s.longitude!,
        status: s.data_status,
      })),
  ];

  return <DigitalTwinClient points={points} layers={layers} cities={cities} />;
}
