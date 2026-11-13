import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading reset form...</div>}>
      <ResetPasswordClient initialToken={sp.token || ""} />
    </Suspense>
  );
}
