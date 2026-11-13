export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export const PERMISSIONS: { code: string; module: string; description: string }[] = [
  { code: "org:manage", module: "Administration", description: "Manage organization profile and workspaces" },
  { code: "users:manage", module: "Administration", description: "Invite users and assign roles" },
  { code: "cities:read", module: "Cities", description: "View registered city profiles and boundaries" },
  { code: "cities:write", module: "Cities", description: "Register and update city profiles" },
  { code: "divisions:read", module: "Divisions", description: "Access the 24 intelligence divisions" },
  { code: "data:read", module: "Data Platform", description: "View datasets, catalogs, and observations" },
  { code: "data:write", module: "Data Platform", description: "Ingest datasets and manage quality checks" },
  { code: "data:export", module: "Data Platform", description: "Export datasets, reports, and sheets" },
  { code: "integrations:manage", module: "Integrations", description: "Configure external data connectors and sync runs" },
  { code: "operations:read", module: "Operations", description: "View assets, projects, work orders, incidents, alerts" },
  { code: "operations:write", module: "Operations", description: "Create and update assets, projects, work orders, incidents" },
  { code: "workflows:approve", module: "Workflows", description: "Approve or reject workflow steps and publications" },
  { code: "sheets:read", module: "SHEETS", description: "Open SMART GRID SHEETS workbooks" },
  { code: "sheets:write", module: "SHEETS", description: "Edit workbooks, run transformations, and save versions" },
  { code: "ai:use", module: "SMART GRID AI", description: "Use SMART GRID AI workspace, assistant, and copilot" },
  { code: "reports:read", module: "Reports", description: "View internal and published reports" },
  { code: "reports:publish", module: "Reports", description: "Approve and publish reports or open datasets" },
  { code: "audit:read", module: "Security & Audit", description: "Read audit logs and security telemetry" },
  { code: "developer:manage", module: "Developer", description: "Create and revoke API keys and webhooks" },
  { code: "billing:manage", module: "Billing", description: "Manage subscription plans and usage quotas" },
];

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.code);

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    code: "SUPER_ADMIN",
    name: "Platform Super Admin",
    description: "Full administrative access across the assigned organization.",
    permissions: ALL_PERMISSIONS,
  },
  {
    code: "ORG_OWNER",
    name: "Organization Owner",
    description: "Owner of organization workspace, billing, governance, and operations.",
    permissions: ALL_PERMISSIONS,
  },
  {
    code: "ORG_ADMIN",
    name: "Organization Admin",
    description: "Manages users, cities, divisions, integrations, and operations.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "billing:manage"),
  },
  {
    code: "CITY_ADMIN",
    name: "City Administrator",
    description: "Manages city profiles, divisions, operations, and reports.",
    permissions: [
      "cities:read", "cities:write", "divisions:read", "data:read", "data:write", "data:export",
      "integrations:manage", "operations:read", "operations:write", "workflows:approve",
      "sheets:read", "sheets:write", "ai:use", "reports:read", "reports:publish",
    ],
  },
  {
    code: "DIVISION_MANAGER",
    name: "Division Manager",
    description: "Leads operations, KPIs, approvals, and datasets within divisions.",
    permissions: [
      "cities:read", "divisions:read", "data:read", "data:write", "data:export",
      "operations:read", "operations:write", "workflows:approve",
      "sheets:read", "sheets:write", "ai:use", "reports:read",
    ],
  },
  {
    code: "DATA_ANALYST",
    name: "Data Analyst",
    description: "Analyzes datasets, builds dashboards, uses SMART GRID SHEETS & AI.",
    permissions: [
      "cities:read", "divisions:read", "data:read", "data:write", "data:export",
      "operations:read", "sheets:read", "sheets:write", "ai:use", "reports:read",
    ],
  },
  {
    code: "OPERATIONS_MANAGER",
    name: "Operations Manager",
    description: "Coordinates assets, projects, work orders, and incident response.",
    permissions: [
      "cities:read", "divisions:read", "data:read", "operations:read", "operations:write",
      "workflows:approve", "sheets:read", "ai:use", "reports:read",
    ],
  },
  {
    code: "AUDITOR",
    name: "Auditor",
    description: "Read-only governance, compliance, and audit log oversight.",
    permissions: [
      "cities:read", "divisions:read", "data:read", "operations:read",
      "sheets:read", "reports:read", "audit:read",
    ],
  },
  {
    code: "DEVELOPER",
    name: "Developer",
    description: "Manages API keys, webhooks, and integration connectors.",
    permissions: [
      "cities:read", "divisions:read", "data:read", "integrations:manage",
      "developer:manage", "reports:read",
    ],
  },
  {
    code: "VIEWER",
    name: "Viewer",
    description: "Read-only access to permitted city intelligence views.",
    permissions: ["cities:read", "divisions:read", "data:read", "operations:read", "sheets:read", "reports:read"],
  },
  {
    code: "CAREER_FEST_VISITOR",
    name: "Career Fest Visitor",
    description:
      "30-minute time-boxed Career Fest showcase visitor with approved exploration access and strict admin/tenant isolation.",
    permissions: [
      "cities:read",
      "divisions:read",
      "data:read",
      "data:export",
      "operations:read",
      "sheets:read",
      "sheets:write",
      "ai:use",
      "reports:read",
    ],
  },
];

export const CAREER_FEST_ROLE_CODE = "CAREER_FEST_VISITOR";

export function isCareerFestRole(roleCode: string): boolean {
  return roleCode === CAREER_FEST_ROLE_CODE;
}

export function getRolePermissions(roleCode: string): string[] {
  return SYSTEM_ROLES.find((r) => r.code === roleCode)?.permissions ?? [];
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required);
}

export function canPublishPublicCity(permissions: string[]): boolean {
  return hasPermission(permissions, "reports:publish") || hasPermission(permissions, "users:manage");
}
