# SMART GRID — DATA INTEGRATION REGISTER

**Project:** SMART GRID — Global Smart City Intelligence & Management Ecosystem
**Principle:** Never fabricate external telemetry, live agency data, or provider availability.

---

## 1. Truthful Status Model (`src/lib/domain/statuses.ts`)

| Status | Meaning | UI Badge Styling |
| --- | --- | --- |
| `LIVE` | Actively ingested from a configured & reachable external provider or live DB state | Gold border & text (`sg-badge-gold`) |
| `HISTORICAL` | Archived benchmark or historical reference series | Neutral pill |
| `SIMULATED` | Synthetic evaluation seed clearly flagged as non-production | Neutral pill |
| `INTEGRATION_REQUIRED` | Connector modeled in platform; awaits operator credentials/endpoint URL | Muted pill |
| `UNAVAILABLE` | External service or AI model unreachable / unconfigured | Muted pill |
| `STALE` | Telemetry past expected freshness interval | Warning tone |
| `ERROR` | Last sync run failed or returned invalid upstream response | Red accent (`sg-badge-error`) |
| `PARTIAL` | Partial coverage across spatial/temporal window | Neutral pill |
| `DISABLED` | Connector intentionally paused by tenant administrator | Grey pill |

---

## 2. Seeded Data Sources & Datasets (`src/lib/db/seed.ts`)

| ID | Organization | Name | Division | Declared Status | Provenance Note |
| --- | --- | --- | --- | --- | --- |
| `src_gtfs_tokyo` | `org_demo_global` | Metropolitan Transit GTFS Feed | `04` Public Transit | `INTEGRATION_REQUIRED` | Requires transit agency API key & GTFS URL |
| `src_aq_dhaka` | `org_demo_global` | Dhaka Air Quality Reference Archive | `05` Environment & AQ | `HISTORICAL` | Historical evaluation CSV benchmark (`ds_dhaka_aq`) |
| `src_grid_singapore` | `org_demo_global` | Energy Substation Telemetry Connector | `07` Energy & Grid | `INTEGRATION_REQUIRED` | Utility SCADA read-only bridge unconfigured |
| `src_weather_london` | `org_demo_global` | London Meteorological Sample Series | `06` Weather & Climate | `SIMULATED` | Synthetic weather & corridor speed evaluation series |
| `src_toronto_lab` | `org_partner_metro` | Lakefront Flood Hazard Connector | `10` Disaster & Risk | `SIMULATED` | Tenant-isolated dataset (`ds_toronto_flood`) |

---

## 3. External Service Connectors

| Service Domain | Code Module | Default Status (No Env Keys) | Required Env Vars to Activate |
| --- | --- | --- | --- |
| SMART GRID AI (Gemini) | `src/lib/ai/provider.ts` | `AI_PROVIDER_UNAVAILABLE` (HTTP 503) | `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.5-flash`) |
| SMART GRID AI (OpenAI-Compatible) | `src/lib/ai/provider.ts` | `AI_PROVIDER_UNAVAILABLE` (HTTP 503) | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL` (default `gpt-4o-mini`) |
| Spatial Basemap & GIS | `src/components/enterprise/DigitalTwinClient.tsx` | GeoJSON Vector Viewport (`SIMULATED` layers) | Interactive coordinate SVG canvas built-in; Mapbox/WMTS tiles optional future extension |
| External Billing / PSP | `src/components/enterprise/BillingClient.tsx` | `INTEGRATION_REQUIRED` (Internal quota tiering active) | Future Stripe / institutional invoicing adapter |
| Connector Sync Runs | `src/app/api/v1/integrations/route.ts` | Logs honest `INTEGRATION_REQUIRED` or `COMPLETED` run | Configured connector credentials in Integration Hub (`/app/integrations`) |
