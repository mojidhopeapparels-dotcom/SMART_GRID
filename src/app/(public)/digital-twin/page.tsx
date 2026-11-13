import type { Metadata } from "next";
import { PublicSectionPage } from "@/components/public/PublicSectionPage";

export const metadata: Metadata = { title: "Digital Twin & GIS" };

export default function PublicDigitalTwinPage() {
  return (
    <PublicSectionPage
      eyebrow="Spatial Intelligence"
      title="Digital Twin & GIS"
      lead="Coordinate-referenced 2D/3D spatial exploration, GeoJSON layer management, proximity/coverage analysis, and hypothetical scenario modeling."
      status="SIMULATED"
      primaryCta={{ href: "/app/digital-twin", label: "Open Digital Twin Explorer" }}
      secondaryCta={{ href: "/cities", label: "Explore Registered Cities" }}
      notice="Coverage Disclosure: Built-in city boundaries and sample point layers are clearly labeled SIMULATED. Complete 3D building geometry requires licensed local LiDAR/CityGML feeds."
      cards={[
        {
          eyebrow: "Layer Engine",
          title: "GIS Layer Manager & CRS Metadata",
          body: "Manages administrative boundaries, asset coordinates, sensor locations, and custom GeoJSON layers with EPSG:4326 coordinate verification.",
        },
        {
          eyebrow: "Spatial Queries",
          title: "Distance, Radius & Coverage Analysis",
          body: "Measure Haversine distances between city assets, find facilities within radius corridors, and inspect point density across districts.",
        },
        {
          eyebrow: "3D Exploration",
          title: "2D / Isometric 3D City Canvas",
          body: "Switch between 2D planimetric GIS layers and an interactive 3D elevation/extrusion view for registered spatial nodes.",
        },
        {
          eyebrow: "Scenario Lab",
          title: "Modeled Hypothetical Overlays",
          body: "Compare baseline indicators against parameterized scenarios (e.g., solar expansion or drainage capacity) labeled strictly as modeled estimates.",
        },
      ]}
    />
  );
}
