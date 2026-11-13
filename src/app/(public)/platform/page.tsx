import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Platform Overview" };

export default function PlatformPage() {
  return (
    <PublicSectionPage
      eyebrow="Architecture & Capabilities"
      title="Platform Overview"
      lead="A modular smart-city platform combining public transparency with isolated enterprise operational workspaces."
      primaryCta={{ href: "/sign-in", label: "Open Enterprise Workspace" }}
      secondaryCta={{ href: "/divisions", label: "Browse 24 Divisions" }}
      cards={[
        {
          eyebrow: "Domain Structure",
          title: "24 Standardized Intelligence Divisions",
          body: "Every city organizes datasets, KPIs, spatial layers, assets, incidents, and reports using one coherent 24-division taxonomy.",
          points: ["01–02 Governance & Spatial Twin", "03–04 Traffic & Public Transit", "05–09 Environment, Energy, Water & Waste", "10–24 Risk, Safety, Health, Planning, IoT, Economy & Food"],
        },
        {
          eyebrow: "Spreadsheet Engine",
          title: "SMART GRID SHEETS",
          body: "Built-in multi-sheet grid with live formula evaluation (=SUM, =AVERAGE, =IF, =ROUND, lookups), CSV/XLSX/JSON import-export, cleaning pipelines, and version history.",
        },
        {
          eyebrow: "Governed AI",
          title: "SMART GRID AI",
          body: "Unified AI workspace, floating contextual assistant, and SHEETS Copilot backed by permission-aware data retrieval and source citations.",
        },
        {
          eyebrow: "Spatial & Operations",
          title: "GIS, Digital Twin & Workflows",
          body: "Coordinate-referenced asset registries, GeoJSON layers, spatial queries, scenario modeling, work orders, incidents, and multi-stage approval workflows.",
        },
      ]}
    />
  );
}
