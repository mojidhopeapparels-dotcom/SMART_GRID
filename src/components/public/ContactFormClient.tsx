"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function ContactFormClient() {
  const [category, setCategory] = useState("Enterprise Demo");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/public/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          organizationName,
          contactName,
          contactEmail,
          message,
          consentAccepted: consent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not submit enquiry.");
      } else {
        setSubmittedId(json.data.enquiryId);
        setOrganizationName("");
        setContactName("");
        setContactEmail("");
        setMessage("");
        setConsent(false);
      }
    } catch {
      setError("Network error while submitting enquiry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="sg-card-gold" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--sg-gold)", fontWeight: 700 }}>
          <CheckCircle2 size={18} /> Enquiry Recorded
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Your enquiry has been stored in SMART GRID under reference{" "}
          <code className="sg-mono">{submittedId}</code>.
        </p>
        <button type="button" className="sg-btn sg-btn-outline" onClick={() => setSubmittedId(null)}>
          Submit Another Enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="sg-card" style={{ display: "grid", gap: "1rem" }}>
      {error && (
        <div className="sg-banner sg-banner-error" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="sg-label" htmlFor="enq-cat">Enquiry Category</label>
        <select id="enq-cat" className="sg-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="Enterprise Demo">Enterprise Demo</option>
          <option value="City Partnership">City Partnership</option>
          <option value="Developer API">Developer API</option>
          <option value="Security & Privacy">Security &amp; Privacy</option>
          <option value="General">General</option>
        </select>
      </div>

      <div className="sg-grid-2">
        <div>
          <label className="sg-label" htmlFor="enq-org">Organization / City Name</label>
          <input
            id="enq-org"
            className="sg-input"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g. Metropolitan Transit Authority"
          />
        </div>
        <div>
          <label className="sg-label" htmlFor="enq-name">Your Name</label>
          <input
            id="enq-name"
            className="sg-input"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Full name"
          />
        </div>
      </div>

      <div>
        <label className="sg-label" htmlFor="enq-email">Work Email</label>
        <input
          id="enq-email"
          type="email"
          className="sg-input"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="name@organization.org"
        />
      </div>

      <div>
        <label className="sg-label" htmlFor="enq-msg">Message &amp; Scope</label>
        <textarea
          id="enq-msg"
          className="sg-textarea"
          rows={4}
          required
          minLength={10}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your target city, divisions, data sources, or institutional questions..."
        />
      </div>

      <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.84rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          style={{ marginTop: 3 }}
        />
        <span>
          I accept the SMART GRID Privacy Policy and consent to processing this enquiry for follow-up.
        </span>
      </label>

      <div>
        <button type="submit" className="sg-btn sg-btn-primary" disabled={submitting}>
          <Send size={15} />
          {submitting ? "Submitting..." : "Submit Enquiry"}
        </button>
      </div>
    </form>
  );
}
