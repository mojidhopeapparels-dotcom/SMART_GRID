import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Data & Integrations" };

export default function PublicDataIntegrationsPage() {
  return (
    <PublicSectionPage
      eyebrow="Data Infrastructure"
      title="Data & Integrations"
      lead="Connect approved municipal APIs, webhooks, GeoJSON services, and CSV/XLSX/JSON archives through one validated ingestion pipeline."
      primaryCta={{ href: "/app/integrations", label: "Open Integration Hub" }}
      secondaryCta={{ href: "/app/data-catalog", label: "Browse Data Catalog" }}
      cards={[
        {
          eyebrow: "Registry",
          title: "Data Source Registry & Sync Health",
          body: "Tracks provider identity, license, update cadence, last successful sync, failure logs, and credential readiness without exposing secrets to the browser.",
        },
        {
          eyebrow: "Validation",
          title: "Schema, Unit & Freshness Checks",
          body: "Every ingested record passes schema validation, unit labeling, quality checks, and automated freshness classification.",
        },
        {
          eyebrow: "Truthful Statuses",
          title: "Standardized Data Status Vocabulary",
          body: "Every dataset carries an honest status: LIVE, HISTORICAL, SIMULATED, UNAVAILABLE, INTEGRATION REQUIRED, STALE, ERROR, PARTIAL, or DISABLED.",
        },
        {
          eyebrow: "Provenance",
          title: "Lineage & Classification Controls",
          body: "Supports PUBLIC, INTERNAL, CONFIDENTIAL, and RESTRICTED classification levels with explicit publication approval workflows.",
        },
      ]}
    />
  );
}
