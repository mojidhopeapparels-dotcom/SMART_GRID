import { SignInForm, type DemoPreset } from "@/components/auth/SignInForm";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const isProd = process.env.NODE_ENV === "production";
  const allowDemoAccounts = isProd
    ? process.env.SMART_GRID_DEMO_MODE === "true"
    : process.env.SMART_GRID_DEMO_MODE !== "false";

  const demoPresets: DemoPreset[] = allowDemoAccounts
    ? [
        {
          label: "Org Owner (Global Observatory)",
          email: "admin@smartgrid.local",
          password: process.env.SMART_GRID_DEMO_ADMIN_PASSWORD || "SmartGrid!Admin2026",
        },
        {
          label: "Data Analyst (Global Observatory)",
          email: "analyst@smartgrid.local",
          password: process.env.SMART_GRID_DEMO_ANALYST_PASSWORD || "SmartGrid!Analyst2026",
        },
        {
          label: "Viewer (Read-Only)",
          email: "viewer@smartgrid.local",
          password: process.env.SMART_GRID_DEMO_VIEWER_PASSWORD || "SmartGrid!Viewer2026",
        },
        {
          label: "Isolated Tenant (Metro Lab)",
          email: "partner@smartgrid.local",
          password: process.env.SMART_GRID_DEMO_PARTNER_PASSWORD || "SmartGrid!Partner2026",
        },
      ]
    : [];

  return <SignInForm allowDemoAccounts={allowDemoAccounts} demoPresets={demoPresets} />;
}
