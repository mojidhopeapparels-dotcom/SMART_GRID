import type { Metadata } from "next";
import { CookiesClient } from "@/components/public/CookiesClient";

export const metadata: Metadata = { title: "Cookie Preferences" };

export default function CookiesPage() {
  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem", maxWidth: "820px" }}>
      <div className="sg-eyebrow">Privacy Controls</div>
      <h1 className="sg-h1">Cookie Preferences</h1>
      <p className="sg-muted" style={{ marginBottom: "1.75rem" }}>
        Manage optional browser storage preferences for SMART GRID. Essential HTTP-only session
        cookies are strictly necessary when signing into the Enterprise Application.
      </p>
      <CookiesClient />
    </div>
  );
}
