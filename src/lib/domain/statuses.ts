export type DataStatus =
  | "LIVE"
  | "HISTORICAL"
  | "SIMULATED"
  | "UNAVAILABLE"
  | "INTEGRATION_REQUIRED"
  | "STALE"
  | "ERROR"
  | "VALIDATING"
  | "PARTIAL"
  | "DISABLED";

export type ClassificationLevel =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED";

export const DATA_STATUS_META: Record<
  DataStatus,
  { label: string; description: string; tone: "gold" | "white" | "grey" | "danger" | "warn" }
> = {
  LIVE: {
    label: "LIVE",
    description: "Active authorized source updates arriving within expected freshness window.",
    tone: "gold",
  },
  HISTORICAL: {
    label: "HISTORICAL",
    description: "Archived or imported historical records; not a live feed.",
    tone: "white",
  },
  SIMULATED: {
    label: "SIMULATED",
    description: "Demonstration, test, or modeled simulation data — not live city telemetry.",
    tone: "grey",
  },
  UNAVAILABLE: {
    label: "UNAVAILABLE",
    description: "Data cannot currently be obtained from the configured source.",
    tone: "danger",
  },
  INTEGRATION_REQUIRED: {
    label: "INTEGRATION REQUIRED",
    description: "An authorized external source connection and credentials must be configured.",
    tone: "warn",
  },
  STALE: {
    label: "STALE",
    description: "Last synchronization is older than the expected update frequency.",
    tone: "warn",
  },
  ERROR: {
    label: "ERROR",
    description: "Connection, validation, or ingestion failure occurred.",
    tone: "danger",
  },
  VALIDATING: {
    label: "VALIDATING",
    description: "Schema and data quality validation currently in progress.",
    tone: "gold",
  },
  PARTIAL: {
    label: "PARTIAL",
    description: "Only part of the expected dataset payload arrived.",
    tone: "warn",
  },
  DISABLED: {
    label: "DISABLED",
    description: "Source or dataset intentionally disabled by an administrator.",
    tone: "grey",
  },
};

export interface ApiPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export function createRequestId(): string {
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function apiSuccess<T>(data: T, extra?: Record<string, unknown>, status = 200) {
  return Response.json(
    {
      data,
      ...extra,
      meta: {
        requestId: createRequestId(),
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function apiPaginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
) {
  return Response.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    meta: {
      requestId: createRequestId(),
      timestamp: new Date().toISOString(),
    },
  });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        requestId: createRequestId(),
      },
    },
    { status }
  );
}
