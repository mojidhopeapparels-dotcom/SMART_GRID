import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a href="#main-content" className="sg-skip-link">
        Skip to main content
      </a>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} style={{ flex: 1 }}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
