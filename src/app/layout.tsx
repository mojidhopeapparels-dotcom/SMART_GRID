import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SMART GRID — The Intelligence Behind Tomorrow's Cities",
    template: "%s | SMART GRID",
  },
  description:
    "Global Smart City Intelligence & Management Ecosystem unifying 24 urban intelligence divisions, trusted data integrations, geospatial intelligence, SMART GRID AI, and SMART GRID SHEETS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
