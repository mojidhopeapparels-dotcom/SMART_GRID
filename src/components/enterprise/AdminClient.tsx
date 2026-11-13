"use client";

import { useState } from "react";
import { UserPlus, ShieldCheck } from "lucide-react";

interface MemberRow {
  membership_id: string;
  role_code: string;
  department: string;
  membership_status: string;
  user_id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  mfa_enabled: number;
}

interface RoleDef {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export function AdminClient({
  organization,
  initialMembers,
  roles,
  permissions,
  canManageUsers,
}: {
  organization: { id: string; name: string; slug: string; plan_code: string; verification_status: string };
  initialMembers: MemberRow[];
  roles: RoleDef[];
  permissions: { code: string; module: string; description: string }[];
  canManageUsers: boolean;
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState("DATA_ANALYST");
  const [department, setDepartment] = useState("City Intelligence");
  const [temporaryPassword, setTemporaryPassword] = useState("TempCityGrid#2026");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");
    const res = await fetch("/api/v1/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INVITE_USER",
        fullName,
        email,
        roleCode,
        department,
        temporaryPassword,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Failed to provision user.");
      return;
    }
    setStatusMsg(`Provisioned ${json.data.email} with role ${json.data.roleCode}.`);
    setShowInvite(false);
    setFullName("");
    setEmail("");
    try {
      const refreshRes = await fetch("/api/v1/admin?scope=overview");
      const refreshed = await refreshRes.json();
      if (refreshRes.ok && refreshed.data?.members) {
        setMembers(refreshed.data.members);
      }
    } catch {
      setErrorMsg("User was created, but failed to refresh the members table.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="sg-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="sg-badge sg-badge-gold">Tenant Administration & RBAC</span>
          <h1 style={{ fontSize: "1.6rem", marginTop: "0.4rem" }}>{organization.name} — Users & Role Matrix</h1>
          <p className="sg-muted" style={{ fontSize: "0.9rem" }}>
            Organization slug: <code>{organization.slug}</code> · Plan: <strong>{organization.plan_code}</strong> · Verification: {organization.verification_status}
          </p>
        </div>
        {canManageUsers && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowInvite(!showInvite)}>
            <UserPlus size={16} /> Provision User
          </button>
        )}
      </div>

      {statusMsg && <div className="sg-badge sg-badge-gold" role="status">{statusMsg}</div>}
      {errorMsg && <div className="sg-banner sg-banner-error" role="alert">{errorMsg}</div>}

      {showInvite && (
        <form onSubmit={onInvite} className="sg-card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Provision Tenant User</h2>
          <div className="sg-grid sg-grid-3">
            <div>
              <label htmlFor="admin-fullname" className="sg-label">Full Name</label>
              <input id="admin-fullname" className="sg-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="admin-email" className="sg-label">Email</label>
              <input id="admin-email" className="sg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="admin-role" className="sg-label">Assigned Role</label>
              <select id="admin-role" className="sg-select" value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-department" className="sg-label">Department</label>
              <input id="admin-department" className="sg-input" value={department} onChange={(e) => setDepartment(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="admin-temp-password" className="sg-label">Initial Password (min 10 chars)</label>
              <input id="admin-temp-password" className="sg-input" type="password" minLength={10} value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Create Account & Assign Role</button>
            <button type="button" className="sg-btn sg-btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-card">
        <h2 style={{ fontSize: "1.15rem", marginBottom: "0.85rem" }}>Organization Members ({members.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="sg-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>MFA</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membership_id}>
                  <td><strong>{m.full_name}</strong></td>
                  <td className="sg-muted">{m.email}</td>
                  <td><span className="sg-badge sg-badge-gold">{m.role_code}</span></td>
                  <td className="sg-muted">{m.department}</td>
                  <td>{m.mfa_enabled ? <span className="sg-badge sg-badge-white">ENABLED</span> : <span className="sg-badge sg-badge-grey">DISABLED</span>}</td>
                  <td>{m.membership_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sg-grid sg-grid-2" style={{ alignItems: "start" }}>
        <div className="sg-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <ShieldCheck size={18} style={{ color: "var(--sg-gold)" }} />
            <h2 style={{ fontSize: "1.15rem" }}>System Roles ({roles.length})</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {roles.map((r) => (
              <div key={r.code} style={{ padding: "0.75rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{r.name}</strong>
                  <span className="sg-badge sg-badge-gold">{r.permissions.length} perms</span>
                </div>
                <p className="sg-muted" style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>{r.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sg-card">
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.85rem" }}>Enforced Permission Scopes ({permissions.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Permission Code</th>
                  <th>Module</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.code}>
                    <td><code>{p.code}</code></td>
                    <td className="sg-muted">{p.module}</td>
                    <td className="sg-muted" style={{ fontSize: "0.82rem" }}>{p.description}</td>
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
