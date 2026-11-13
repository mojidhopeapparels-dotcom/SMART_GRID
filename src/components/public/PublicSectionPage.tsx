import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface PublicCardItem {
  eyebrow?: string;
  title: string;
  body: string;
  points?: string[];
}

export function PublicSectionPage({
  eyebrow,
  title,
  lead,
  status,
  primaryCta,
  secondaryCta,
  cards,
  notice,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  status?: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  cards: PublicCardItem[];
  notice?: string;
}) {
  return (
    <div className="sg-container" style={{ padding: "3rem 1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ maxWidth: "780px" }}>
          <div className="sg-eyebrow">{eyebrow}</div>
          <h1 className="sg-h1">{title}</h1>
          <p className="sg-muted" style={{ fontSize: "1.05rem", margin: 0 }}>{lead}</p>
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>

      {(primaryCta || secondaryCta) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
          {primaryCta && (
            <Link href={primaryCta.href} className="sg-btn sg-btn-primary">
              {primaryCta.label} <ArrowRight size={15} />
            </Link>
          )}
          {secondaryCta && (
            <Link href={secondaryCta.href} className="sg-btn sg-btn-outline">
              {secondaryCta.label}
            </Link>
          )}
        </div>
      )}

      {notice && (
        <div className="sg-banner" style={{ marginTop: "1.75rem" }}>
          {notice}
        </div>
      )}

      <div className="sg-grid-2" style={{ marginTop: "2rem" }}>
        {cards.map((c) => (
          <div key={c.title} className="sg-card">
            {c.eyebrow && <div className="sg-eyebrow" style={{ marginBottom: "0.35rem" }}>{c.eyebrow}</div>}
            <h2 className="sg-h3">{c.title}</h2>
            <p className="sg-muted" style={{ fontSize: "0.88rem", margin: 0 }}>{c.body}</p>
            {c.points && c.points.length > 0 && (
              <ul style={{ paddingLeft: "1.1rem", margin: "0.75rem 0 0", display: "grid", gap: "0.35rem", fontSize: "0.85rem" }}>
                {c.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
