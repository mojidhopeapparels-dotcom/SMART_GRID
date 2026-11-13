"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ShieldCheck, ArrowRight } from "lucide-react";

const PRIMARY_NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/divisions", label: "24 Divisions" },
  { href: "/ai", label: "SMART GRID AI" },
  { href: "/sheets", label: "SHEETS" },
  { href: "/digital-twin", label: "Digital Twin" },
  { href: "/cities", label: "Cities" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sg-pub-header">
      <div className="sg-container sg-pub-nav-inner">
        <Link href="/" className="sg-brand-mark" aria-label="SMART GRID Home">
          <span className="sg-brand-emblem">SG</span>
          <span>SMART GRID</span>
        </Link>

        <nav className="sg-pub-links" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: active ? "var(--sg-gold)" : undefined,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Link href="/contact" className="sg-btn sg-btn-outline" style={{ padding: "0.45rem 0.85rem" }}>
            Contact
          </Link>
          <Link href="/sign-in" className="sg-btn sg-btn-primary" style={{ padding: "0.45rem 0.9rem" }}>
            Enterprise Sign In
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="sg-btn sg-btn-ghost sg-mobile-only"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Mobile navigation"
          style={{
            borderTop: "1px solid var(--sg-border)",
            background: "var(--sg-black)",
            padding: "1rem 1.25rem",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ padding: "0.4rem 0", color: pathname === item.href ? "var(--sg-gold)" : "var(--sg-white)" }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
          <Link href="/solutions" onClick={() => setOpen(false)}>Enterprise Solutions</Link>
          <Link href="/developers" onClick={() => setOpen(false)}>Developer Portal</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About SMART GRID</Link>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--sg-border)",
        background: "#050505",
        padding: "3rem 0 2rem",
        marginTop: "4rem",
      }}
    >
      <div className="sg-container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "2rem",
          }}
        >
          <div>
            <div className="sg-brand-mark" style={{ marginBottom: "0.65rem" }}>
              <span className="sg-brand-emblem">SG</span>
              <span>SMART GRID</span>
            </div>
            <p className="sg-muted" style={{ fontSize: "0.84rem", margin: "0 0 0.75rem" }}>
              The Intelligence Behind Tomorrow&apos;s Cities.
            </p>
            <div className="sg-badge sg-badge-gold">
              <ShieldCheck size={13} aria-hidden="true" />
              Truthful Data Architecture
            </div>
          </div>

          <div>
            <div className="sg-eyebrow" style={{ marginBottom: "0.65rem" }}>Platform</div>
            <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }} className="sg-muted">
              <Link href="/platform">Platform Overview</Link>
              <Link href="/divisions">24 Intelligence Divisions</Link>
              <Link href="/ai">SMART GRID AI</Link>
              <Link href="/sheets">SMART GRID SHEETS</Link>
              <Link href="/digital-twin">Digital Twin & GIS</Link>
              <Link href="/data-integrations">Data & Integrations</Link>
            </div>
          </div>

          <div>
            <div className="sg-eyebrow" style={{ marginBottom: "0.65rem" }}>Ecosystem</div>
            <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }} className="sg-muted">
              <Link href="/solutions">Enterprise Solutions</Link>
              <Link href="/career-fest">Career Fest 2026 Showcase</Link>
              <Link href="/cities">Global City Network</Link>
              <Link href="/security">Security & Data Trust</Link>
              <Link href="/developers">Developer Portal</Link>
              <Link href="/docs">Documentation</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>

          <div>
            <div className="sg-eyebrow" style={{ marginBottom: "0.65rem" }}>Company & Trust</div>
            <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.85rem" }} className="sg-muted">
              <Link href="/about">About SMART GRID</Link>
              <Link href="/pricing">Plans & Entitlements</Link>
              <Link href="/contact">Contact & Enquiries</Link>
              <Link href="/status">System Status</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Use</Link>
              <Link href="/cookies">Cookie Preferences</Link>
              <Link href="/accessibility">Accessibility Statement</Link>
            </div>
          </div>
        </div>

        <hr className="sg-divider" />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "0.75rem",
            fontSize: "0.78rem",
          }}
          className="sg-muted"
        >
          <span>SMART GRID — Global Smart City Intelligence & Management Ecosystem.</span>
          <span>Sample/evaluation datasets are explicitly labeled SIMULATED or HISTORICAL.</span>
        </div>
      </div>
    </footer>
  );
}
