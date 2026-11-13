import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Pricing & Plans" };

export default function PricingPage() {
  return (
    <PublicSectionPage
      eyebrow="Planning Tiers"
      title="Plans & Entitlements"
      lead="Modular subscription tiers aligned to team size, storage, API throughput, and multi-city governance."
      primaryCta={{ href: "/sign-up", label: "Start Organization Workspace" }}
      secondaryCta={{ href: "/contact", label: "Request Institutional Quote" }}
      notice="Pricing Transparency: Figures below describe planning tier structures and entitlements. Final institutional pricing depends on deployment topology, data volume, and contracted support—no fabricated promotional pricing is published."
      cards={[
        {
          eyebrow: "Tier 01",
          title: "Public Explorer",
          body: "Open access to published city profiles, public datasets, approved transparency briefs, and platform documentation.",
          points: ["Public City Network", "24 Division Blueprints", "Published Open Data"],
        },
        {
          eyebrow: "Tier 02",
          title: "Starter & Professional",
          body: "Authenticated organization workspaces with SMART GRID SHEETS, CSV/XLSX/JSON imports, core division analytics, and standard RBAC.",
          points: ["Up to 50 seats (configurable)", "SMART GRID SHEETS + Formula Engine", "Versioned Reports & Exports"],
        },
        {
          eyebrow: "Tier 03",
          title: "Enterprise",
          body: "Full 24-division operational suite with Integration Hub connectors, Workflow Approvals, Security & Audit Center, Developer API Keys, and governed AI.",
          points: ["TOTP MFA & Fine-grained RBAC", "Integration Hub & Webhooks", "AI Governance & Quotas"],
        },
        {
          eyebrow: "Tier 04",
          title: "City Network & Custom Institutional",
          body: "Multi-city benchmarking, dedicated infrastructure isolation, custom geospatial ingestion, and institutional SLA agreements.",
          points: ["Multi-city executive comparison", "Dedicated PostgreSQL/PostGIS option", "Custom integration engineering"],
        },
      ]}
    />
  );
}
