import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "SMART GRID SHEETS" };

export default function PublicSheetsPage() {
  return (
    <PublicSectionPage
      eyebrow="Universal Data Workspace"
      title="SMART GRID SHEETS"
      lead="Enterprise spreadsheet, formula evaluation, data cleaning, transformation, visualization, and import/export engine built directly into SMART GRID."
      status="LIVE"
      primaryCta={{ href: "/app/sheets", label: "Launch SMART GRID SHEETS" }}
      secondaryCta={{ href: "/docs", label: "Formula & Import Guide" }}
      cards={[
        {
          eyebrow: "Calculation Engine",
          title: "Formula Parser & Dependency Graph",
          body: "Supports arithmetic expressions, SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, ROUND, CONCAT, LEFT, RIGHT, MID, DATE, TODAY, and VLOOKUP with circular reference detection.",
        },
        {
          eyebrow: "Import Pipeline",
          title: "CSV, XLSX & JSON Ingestion",
          body: "Validates file types, previews rows, detects column types, scans for duplicates and missing values, and imports directly into versioned worksheets.",
        },
        {
          eyebrow: "Data Cleaning",
          title: "Transformation Studio",
          body: "Sort, filter, deduplicate, fill missing values, trim/normalize text, and generate live charts directly from worksheet columns.",
        },
        {
          eyebrow: "Governance",
          title: "Versioning, Audit & Export",
          body: "Save immutable workbook snapshots, restore prior versions, and export sheets to CSV, XLSX, or JSON under server-side export permissions.",
        },
      ]}
    />
  );
}
