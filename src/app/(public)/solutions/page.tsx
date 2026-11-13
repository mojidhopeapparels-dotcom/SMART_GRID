import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Enterprise Solutions" };

export default function SolutionsPage() {
  return (
    <PublicSectionPage
      eyebrow="Customer Segments"
      title="Enterprise Solutions"
      lead="Role-tailored urban intelligence workspaces for municipalities, national agencies, utility operators, and research institutions."
      primaryCta={{ href: "/sign-up", label: "Create Organization Workspace" }}
      secondaryCta={{ href: "/contact", label: "Request Institutional Onboarding" }}
      cards={[
        {
          eyebrow: "Government & Municipalities",
          title: "City Command & Cross-Department Coordination",
          body: "Unify strategic KPIs, capital projects, service requests, and public transparency releases across municipal departments.",
        },
        {
          eyebrow: "Utilities & Infrastructure",
          title: "Asset Lifecycle, Sensors & Preventive Maintenance",
          body: "Track substations, water treatment plants, street lighting, inspections, and work orders with full audit trails.",
        },
        {
          eyebrow: "Urban Planners & GIS Teams",
          title: "Spatial Coverage & Scenario Comparison",
          body: "Evaluate zoning, transit access, hazard exposure, and infrastructure capacity gaps across administrative districts.",
        },
        {
          eyebrow: "Universities & Research",
          title: "Reproducible Datasets & SHEETS Analytics",
          body: "Import historical archives, run formula-audited models in SMART GRID SHEETS, and export cited analytical reports.",
        },
      ]}
    />
  );
}
