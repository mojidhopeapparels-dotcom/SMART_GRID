"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  Code2,
  CreditCard,
  Database,
  FileText,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  Shield,
  Table2,
  Users,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { FloatingAiAssistant } from "@/components/enterprise/FloatingAiAssistant";
import { CareerFestBanner } from "@/components/enterprise/CareerFestBanner";

interface NavItem {
  href: string;
  label: string;
  perm?: string;
  hideForVisitor?: boolean;
  icon: React.ComponentType<{ size?: number }>;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Home & Overview",
    items: [
      { href: "/app", label: "Workspace Home", icon: LayoutDashboard },
      { href: "/app/command-center", label: "Global Command Center", icon: Activity },
      { href: "/app/cities", label: "Global City Network", perm: "cities:read", icon: Globe2 },
      { href: "/app/search", label: "Global Search", icon: Search },
    ],
  },
  {
    label: "City Intelligence",
    items: [
      { href: "/app/divisions", label: "24 Divisions", perm: "divisions:read", icon: Layers },
      { href: "/app/city-pulse", label: "City Pulse & Events", perm: "operations:read", icon: Activity },
      { href: "/app/sustainability", label: "Sustainability & SDGs", perm: "divisions:read", icon: Globe2 },
    ],
  },
  {
    label: "Map & Spatial",
    items: [
      { href: "/app/digital-twin", label: "Digital Twin & GIS", perm: "cities:read", icon: MapPin },
      { href: "/app/scenarios", label: "Scenario Laboratory", perm: "operations:read", icon: Layers },
    ],
  },
  {
    label: "AI & SHEETS",
    items: [
      { href: "/app/ai", label: "SMART GRID AI Workspace", perm: "ai:use", icon: Bot },
      { href: "/app/sheets", label: "SMART GRID SHEETS", perm: "sheets:read", icon: Table2 },
    ],
  },
  {
    label: "Data & Analytics",
    items: [
      { href: "/app/data-catalog", label: "Data Catalog & Quality", perm: "data:read", icon: Database },
      { href: "/app/integrations", label: "Integration Hub", perm: "data:read", icon: Workflow },
      { href: "/app/analytics", label: "Analytics & Dashboards", perm: "data:read", icon: BarChart3 },
      { href: "/app/reports", label: "Report Center", perm: "reports:read", icon: FileText },
    ],
  },
  {
    label: "Operations & Governance",
    items: [
      { href: "/app/alerts", label: "Alert & Notification Center", perm: "operations:read", icon: Bell },
      { href: "/app/operations", label: "Assets, Projects & Work Orders", perm: "operations:read", icon: Wrench },
      { href: "/app/workflows", label: "Workflow & Approvals", perm: "operations:read", icon: Workflow },
      { href: "/app/documents", label: "Documents & Records", perm: "operations:read", icon: FileText },
      { href: "/app/calendar", label: "Calendar & Collaboration", perm: "operations:read", icon: Calendar },
      { href: "/app/procurement", label: "Procurement & Vendors", perm: "operations:read", icon: Building2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/app/admin", label: "Users, Roles & Orgs", perm: "org:manage", icon: Users },
      { href: "/app/security", label: "Security & Audit Center", perm: "audit:read", icon: Shield },
      { href: "/app/developer", label: "Developer & API Keys", perm: "developer:manage", icon: Code2 },
      { href: "/app/billing", label: "Billing & System Health", perm: "billing:manage", icon: CreditCard },
      { href: "/app/settings", label: "Account & MFA Settings", hideForVisitor: true, icon: Settings },
      { href: "/docs", label: "Knowledge Center", icon: HelpCircle },
    ],
  },
];

export function EnterpriseShell({
  ctx,
  cities,
  children,
}: {
  ctx: AuthContext;
  cities: { id: string; name: string; slug: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  async function switchContext(payload: { organizationId?: string; cityId?: string | null }) {
    await fetch("/api/v1/auth/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    router.refresh();
  }

  async function signOut() {
    if (ctx.isCareerFestVisitor) {
      await fetch("/api/career-fest/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      router.push("/career-fest?ended=1");
      router.refresh();
      return;
    }
    await fetch("/api/v1/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="sg-app-shell">
      <a href="#main-content" className="sg-skip-link">
        Skip to main content
      </a>
      {sidebarOpen && (
        <button
          type="button"
          className="sg-sidebar-backdrop"
          aria-label="Close navigation sidebar overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sg-sidebar ${sidebarOpen ? "sg-sidebar-open" : ""}`} aria-label="Enterprise Sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0.5rem 0.9rem" }}>
          <Link href="/app" className="sg-brand-mark" onClick={() => setSidebarOpen(false)}>
            <span className="sg-brand-emblem">SG</span>
            <span>SMART GRID</span>
          </Link>
          <button
            type="button"
            className="sg-btn sg-btn-ghost sg-mobile-only"
            style={{ padding: "0.3rem" }}
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "0 0.5rem 0.75rem", borderBottom: "1px solid var(--sg-border)" }}>
          <div className="sg-label">Organization</div>
          {ctx.isCareerFestVisitor ? (
            <div
              style={{
                padding: "0.45rem 0.65rem",
                borderRadius: "var(--sg-radius-sm)",
                border: "1px solid var(--sg-gold-border)",
                background: "var(--sg-gold-soft)",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--sg-white)",
              }}
            >
              {ctx.organizationName}
            </div>
          ) : (
            <select
              className="sg-select"
              aria-label="Switch active organization"
              value={ctx.organizationId}
              onChange={(e) => switchContext({ organizationId: e.target.value })}
            >
              {ctx.memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          )}
        </div>

        <nav style={{ flex: 1 }}>
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) =>
                (!item.perm || ctx.permissions.includes(item.perm)) &&
                (!ctx.isCareerFestVisitor || !item.hideForVisitor)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="sg-nav-group-label">{group.label}</div>
                <div style={{ display: "grid", gap: "0.18rem" }}>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.href === "/app"
                        ? pathname === "/app"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`sg-nav-item ${active ? "sg-nav-item-active" : ""}`}
                      >
                        <Icon size={15} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid var(--sg-border)", paddingTop: "0.85rem", marginTop: "1rem", fontSize: "0.78rem" }}>
          <div style={{ fontWeight: 700 }}>{ctx.fullName}</div>
          <div className="sg-muted">{ctx.roleCode}</div>
          <button
            type="button"
            onClick={signOut}
            className="sg-btn sg-btn-ghost"
            style={{ width: "100%", marginTop: "0.6rem", justifyContent: "flex-start" }}
          >
            <LogOut size={14} /> {ctx.isCareerFestVisitor ? "Exit Demo" : "Sign Out"}
          </button>
        </div>
      </aside>

      <div className="sg-app-main">
        {ctx.isCareerFestVisitor && (
          <CareerFestBanner
            expiresAt={ctx.sessionExpiresAt}
            initialRemainingSeconds={ctx.sessionRemainingSeconds}
          />
        )}
        <header className="sg-app-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1 }}>
            <button
              type="button"
              className="sg-btn sg-btn-ghost sg-mobile-only"
              aria-label="Open navigation sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchTerm.trim()) {
                  router.push(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`);
                }
              }}
              style={{ flex: "1 1 220px", maxWidth: "380px", position: "relative" }}
            >
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--sg-grey)" }} />
              <input
                type="search"
                className="sg-input"
                style={{ paddingLeft: "1.9rem", paddingTop: "0.42rem", paddingBottom: "0.42rem" }}
                placeholder="Search cities, divisions, datasets, assets..."
                aria-label="Global enterprise search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <select
              className="sg-select"
              style={{ width: "auto", paddingTop: "0.4rem", paddingBottom: "0.4rem" }}
              aria-label="Select active city context"
              value={ctx.activeCityId || ""}
              onChange={(e) => switchContext({ cityId: e.target.value || null })}
            >
              <option value="">All Permitted Cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <Link href="/app/alerts" className="sg-btn sg-btn-ghost" style={{ padding: "0.42rem 0.65rem" }} aria-label="Alert and Notification Center">
              <Bell size={15} />
            </Link>
            <Link href="/" className="sg-btn sg-btn-outline" style={{ padding: "0.42rem 0.75rem", fontSize: "0.78rem" }}>
              Public Site
            </Link>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="sg-app-content">
          {children}
        </main>
      </div>

      {ctx.permissions.includes("ai:use") && (
        <FloatingAiAssistant activeCityId={ctx.activeCityId} />
      )}
    </div>
  );
}
