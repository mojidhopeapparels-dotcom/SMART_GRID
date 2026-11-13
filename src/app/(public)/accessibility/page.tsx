import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Accessibility Statement" };

export default function AccessibilityPage() {
  return (
    <PublicSectionPage
      eyebrow="Inclusive Design"
      title="Accessibility Statement"
      lead="SMART GRID is engineered for keyboard navigation, visible focus indicators, semantic landmarks, reduced motion support, and readable contrast across our locked #080808 / #C9A227 / #FFFFFF / #737373 palette."
      cards={[
        {
          title: "Keyboard & Focus Accessibility",
          body: "All navigation menus, division filters, forms, modal dialogs, and spreadsheet cells support keyboard traversal with high-contrast #C9A227 focus rings.",
        },
        {
          title: "Reduced Motion & Responsive Scaling",
          body: "Honors prefers-reduced-motion media queries and adapts cleanly across desktop, tablet, and mobile viewports.",
        },
        {
          title: "Semantic HTML & ARIA",
          body: "Uses semantic header/nav/main/footer landmarks, explicit form labels, and ARIA live status announcements for async operations.",
        },
        {
          title: "Report an Accessibility Barrier",
          body: "Use the Contact page under General or Enterprise enquiries to report any assistive technology or contrast barrier.",
        },
      ]}
    />
  );
}
