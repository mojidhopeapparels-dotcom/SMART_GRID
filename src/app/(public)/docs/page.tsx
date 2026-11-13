import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsPage() {
  return (
    <PublicSectionPage
      eyebrow="Documentation"
      title="SMART GRID Platform Guides"
      lead="Technical and operational documentation covering onboarding, 24 divisions, data ingestion, SMART GRID SHEETS formulas, and API contracts."
      primaryCta={{ href: "/developers", label: "Developer API Reference" }}
      secondaryCta={{ href: "/sign-in", label: "Open Enterprise App" }}
      cards={[
        {
          eyebrow: "01 · Getting Started",
          title: "Organization & City Onboarding",
          body: "Register an organization via Sign Up, enroll TOTP MFA in Settings, register cities with GeoJSON boundaries, and invite team members with scoped roles.",
        },
        {
          eyebrow: "02 · Data Ingestion",
          title: "Connecting Data Sources & CSV/XLSX/JSON",
          body: "Use Integration Hub to register REST/GeoJSON connectors or upload CSV/XLSX/JSON datasets. Every dataset records schema, quality score, and data status.",
        },
        {
          eyebrow: "03 · SMART GRID SHEETS",
          title: "Formula Reference & Cleaning Pipeline",
          body: "Supported functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, ROUND, CONCAT, LEFT, RIGHT, MID, DATE, TODAY, and VLOOKUP.",
        },
        {
          eyebrow: "04 · Governance",
          title: "Workflows, Approvals & Audit Trail",
          body: "Route work orders and report publications through multi-stage human approvals. Every mutation logs to the organization audit center.",
        },
      ]}
    />
  );
}
