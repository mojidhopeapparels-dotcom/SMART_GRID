import { DATA_STATUS_META, type DataStatus } from "@/lib/domain/statuses";

export function StatusBadge({
  status,
  showDescription = false,
}: {
  status: string;
  showDescription?: boolean;
}) {
  const normalized = (status?.toUpperCase() || "UNAVAILABLE") as DataStatus;
  const meta = DATA_STATUS_META[normalized] ?? {
    label: status || "UNKNOWN",
    description: "Custom operational status.",
    tone: "grey" as const,
  };

  const cls =
    meta.tone === "gold"
      ? "sg-badge sg-badge-gold"
      : meta.tone === "white"
        ? "sg-badge sg-badge-white"
        : meta.tone === "warn"
          ? "sg-badge sg-badge-warn"
          : meta.tone === "danger"
            ? "sg-badge sg-badge-danger"
            : "sg-badge sg-badge-grey";

  return (
    <span className={cls} title={meta.description}>
      <span aria-hidden="true">●</span>
      {meta.label}
      {showDescription ? <span style={{ fontWeight: 400 }}>— {meta.description}</span> : null}
    </span>
  );
}
