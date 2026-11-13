"use client";

import { useState } from "react";
import { Briefcase, Plus } from "lucide-react";

interface VendorRow {
  id: string;
  name: string;
  category: string;
  compliance_status: string;
  contact_email: string | null;
  created_at: string;
}

interface ContractRow {
  id: string;
  title: string;
  contract_value: number;
  currency: string;
  status: string;
  end_date: string | null;
  vendor_name?: string | null;
}

export function ProcurementClient({
  initialVendors,
  initialContracts,
  canWrite,
}: {
  initialVendors: VendorRow[];
  initialContracts: ContractRow[];
  canWrite: boolean;
}) {
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors);
  const [contracts] = useState<ContractRow[]>(initialContracts);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Grid Telemetry Hardware");
  const [contactEmail, setContactEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  async function onCreateVendor(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/v1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "vendor",
          name,
          category,
          contactEmail: contactEmail || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message || "Failed to register vendor.");
        return;
      }
      const updated = await fetch("/api/v1/operations?type=procurement").then((r) => r.json());
      if (updated.data?.vendors) setVendors(updated.data.vendors);
      setShowAdd(false);
      setName("");
      setContactEmail("");
    } catch {
      setError("Network error while registering vendor.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="sg-badge sg-badge-gold">Division 19 · Municipal Finance & Supply</span>
          <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>Procurement & Vendor Registry</h1>
          <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
            Track municipal contractors, compliance posture, and active infrastructure contracts.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={16} /> Register Vendor
          </button>
        )}
      </div>

      {error && <div className="sg-banner sg-banner-error" role="alert">{error}</div>}

      {showAdd && (
        <form onSubmit={onCreateVendor} className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Register Municipal Vendor</h2>
          <div className="sg-grid sg-grid-3">
            <div>
              <label htmlFor="vendor-name" className="sg-label">Vendor Name</label>
              <input id="vendor-name" className="sg-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Meridian Sensor Systems" />
            </div>
            <div>
              <label htmlFor="vendor-category" className="sg-label">Category</label>
              <input id="vendor-category" className="sg-input" value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="vendor-email" className="sg-label">Compliance Contact Email</label>
              <input id="vendor-email" className="sg-input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="bids@example.org" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Save Vendor</button>
            <button type="button" className="sg-btn sg-btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-grid sg-grid-2" style={{ alignItems: "start" }}>
        <div className="sg-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <Briefcase size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>Approved Vendors ({vendors.length})</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.name}</strong></td>
                    <td className="sg-muted">{v.category}</td>
                    <td><span className="sg-badge sg-badge-gold">{v.compliance_status}</span></td>
                    <td className="sg-muted">{v.contact_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sg-card">
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.85rem" }}>Active Contracts ({contracts.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Vendor</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.title}</strong></td>
                    <td className="sg-muted">{c.vendor_name || "Unassigned"}</td>
                    <td>{c.currency} {Number(c.contract_value).toLocaleString()}</td>
                    <td><span className="sg-badge sg-badge-white">{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
