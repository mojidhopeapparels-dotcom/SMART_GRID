import type { Metadata } from "next";
import { ContactFormClient } from "@/components/public/ContactFormClient";

export const metadata: Metadata = {
  title: "Contact",
  description: "Submit an enterprise, municipal, developer, or security enquiry to SMART GRID.",
};

export default function ContactPage() {
  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem", maxWidth: "880px" }}>
      <div className="sg-eyebrow">Request Information</div>
      <h1 className="sg-h1">Contact SMART GRID</h1>
      <p className="sg-muted" style={{ marginBottom: "2rem" }}>
        Submit an enquiry for municipal onboarding, enterprise evaluation, developer API access, or
        security/privacy review. Submissions are persisted with rate limiting and consent tracking.
      </p>
      <ContactFormClient />
    </div>
  );
}
