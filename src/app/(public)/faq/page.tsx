import type { Metadata } from "next";
import { FaqClient } from "@/components/public/FaqClient";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem", maxWidth: "960px" }}>
      <div className="sg-eyebrow">Knowledge Base</div>
      <h1 className="sg-h1">Frequently Asked Questions</h1>
      <p className="sg-muted" style={{ marginBottom: "2rem" }}>
        Clear, verified answers on SMART GRID architecture, data truthfulness, security, AI, and
        spreadsheet capabilities.
      </p>
      <FaqClient />
    </div>
  );
}
