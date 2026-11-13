"use client";

import { useMemo, useState } from "react";
import { Compass, Layers, Ruler, Box } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SpatialPoint {
  id: string;
  name: string;
  kind: "ASSET" | "SENSOR" | "PROJECT" | "CITY";
  divisionCode?: string;
  latitude: number;
  longitude: number;
  status: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DigitalTwinClient({
  points,
  layers,
  cities,
}: {
  points: SpatialPoint[];
  layers: { id: string; name: string; layer_type: string; crs: string; data_status: string; source_name: string }[];
  cities: { id: string; name: string; latitude: number; longitude: number }[];
}) {
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [showAssets, setShowAssets] = useState(true);
  const [showSensors, setShowSensors] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string>("ALL");
  const [pointA, setPointA] = useState<string>(points[0]?.id || "");
  const [pointB, setPointB] = useState<string>(points[1]?.id || "");
  const [radiusKm, setRadiusKm] = useState(15);

  const visiblePoints = useMemo(() => {
    return points.filter((p) => {
      if (p.kind === "ASSET" && !showAssets) return false;
      if (p.kind === "SENSOR" && !showSensors) return false;
      if (p.kind === "CITY" && !showCities) return false;
      return true;
    });
  }, [points, showAssets, showSensors, showCities]);

  const focusedCity = cities.find((c) => c.id === selectedCityId);

  const bounds = useMemo(() => {
    const source = focusedCity ? [focusedCity] : visiblePoints.length ? visiblePoints : cities;
    if (source.length === 0) return { minLat: -60, maxLat: 60, minLng: -180, maxLng: 180 };
    if (focusedCity) {
      return {
        minLat: focusedCity.latitude - 0.2,
        maxLat: focusedCity.latitude + 0.2,
        minLng: focusedCity.longitude - 0.25,
        maxLng: focusedCity.longitude + 0.25,
      };
    }
    const lats = source.map((s) => s.latitude);
    const lngs = source.map((s) => s.longitude);
    const padLat = Math.max(5, (Math.max(...lats) - Math.min(...lats)) * 0.2);
    const padLng = Math.max(10, (Math.max(...lngs) - Math.min(...lngs)) * 0.2);
    return {
      minLat: Math.min(...lats) - padLat,
      maxLat: Math.max(...lats) + padLat,
      minLng: Math.min(...lngs) - padLng,
      maxLng: Math.max(...lngs) + padLng,
    };
  }, [focusedCity, visiblePoints, cities]);

  const project = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / Math.max(0.0001, bounds.maxLng - bounds.minLng)) * 760 + 20;
    const y = (1 - (lat - bounds.minLat) / Math.max(0.0001, bounds.maxLat - bounds.minLat)) * 360 + 20;
    return { x, y };
  };

  const pA = points.find((p) => p.id === pointA);
  const pB = points.find((p) => p.id === pointB);
  const measuredKm = pA && pB ? haversineKm(pA.latitude, pA.longitude, pB.latitude, pB.longitude) : null;
  const nearbyCount = pA
    ? points.filter((p) => p.id !== pA.id && haversineKm(pA.latitude, pA.longitude, p.latitude, p.longitude) <= radiusKm).length
    : 0;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div className="sg-eyebrow">Spatial Intelligence &amp; Geometry</div>
          <h1 className="sg-h1" style={{ fontSize: "2rem", marginBottom: "0.2rem" }}>Digital Twin &amp; GIS Explorer</h1>
          <p className="sg-muted" style={{ margin: 0 }}>
            Coordinate-referenced spatial canvas (EPSG:4326), layer toggles, proximity coverage, and 2D/3D view modes.
          </p>
        </div>
        <StatusBadge status="SIMULATED" />
      </div>

      <div className="sg-banner">
        <strong>Geometry Disclosure:</strong> Spatial coordinates and sample boundary polygons shown
        here are labeled <code>SIMULATED</code>. Complete 3D building meshes require licensed LiDAR /
        CityGML sources.
      </div>

      <div className="sg-split-sidebar">
        {/* Layer Manager */}
        <div className="sg-card" style={{ display: "grid", gap: "0.85rem" }}>
          <div className="sg-eyebrow"><Layers size={13} style={{ display: "inline", marginRight: 4 }} />GIS Layer Manager</div>

          <div>
            <label className="sg-label" htmlFor="dt-city">Viewport Focus</label>
            <select id="dt-city" className="sg-select" value={selectedCityId} onChange={(e) => setSelectedCityId(e.target.value)}>
              <option value="ALL">Global Network View</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button type="button" className={`sg-btn ${viewMode === "2D" ? "sg-btn-primary" : "sg-btn-ghost"}`} style={{ flex: 1 }} onClick={() => setViewMode("2D")}>
              <Compass size={14} /> 2D Map
            </button>
            <button type="button" className={`sg-btn ${viewMode === "3D" ? "sg-btn-primary" : "sg-btn-ghost"}`} style={{ flex: 1 }} onClick={() => setViewMode("3D")}>
              <Box size={14} /> 3D Twin
            </button>
          </div>

          <div style={{ display: "grid", gap: "0.45rem", fontSize: "0.85rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} />
              City Centroids
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showAssets} onChange={(e) => setShowAssets(e.target.checked)} />
              Infrastructure Assets
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showSensors} onChange={(e) => setShowSensors(e.target.checked)} />
              IoT Sensor Nodes
            </label>
          </div>

          <hr className="sg-divider" style={{ margin: "0.25rem 0" }} />
          <div className="sg-eyebrow">Registered Layers ({layers.length})</div>
          {layers.map((l) => (
            <div key={l.id} style={{ fontSize: "0.78rem", borderBottom: "1px solid var(--sg-border)", paddingBottom: "0.45rem" }}>
              <div style={{ fontWeight: 700 }}>{l.name}</div>
              <div className="sg-muted">{l.crs} · {l.layer_type}</div>
            </div>
          ))}
        </div>

        {/* Interactive Spatial SVG Canvas */}
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="sg-card" style={{ padding: "0.75rem", overflow: "hidden" }}>
            <svg
              viewBox="0 0 800 400"
              role="img"
              aria-label="SMART GRID Spatial Map Canvas"
              style={{
                width: "100%",
                height: "auto",
                background: "#050505",
                borderRadius: 8,
                border: "1px solid var(--sg-border)",
                transform: viewMode === "3D" ? "perspective(900px) rotateX(24deg) scale(0.95)" : undefined,
                transition: "transform 250ms ease",
              }}
            >
              {/* Coordinate Grid */}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`vg-${i}`} x1={(i + 1) * 80} y1={0} x2={(i + 1) * 80} y2={400} stroke="#1a1a1a" strokeWidth={1} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`hg-${i}`} x1={0} y1={(i + 1) * 66} x2={800} y2={(i + 1) * 66} stroke="#1a1a1a" strokeWidth={1} />
              ))}

              {/* Distance line between A and B */}
              {pA && pB && (() => {
                const a = project(pA.latitude, pA.longitude);
                const b = project(pB.latitude, pB.longitude);
                return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C9A227" strokeDasharray="5 4" strokeWidth={1.6} />;
              })()}

              {/* Spatial Points */}
              {visiblePoints.map((pt) => {
                const { x, y } = project(pt.latitude, pt.longitude);
                const color = pt.kind === "CITY" ? "#FFFFFF" : pt.kind === "ASSET" ? "#C9A227" : "#A3A3A3";
                return (
                  <g key={pt.id}>
                    {viewMode === "3D" && (
                      <line x1={x} y1={y} x2={x} y2={y - 22} stroke="#C9A227" strokeWidth={3} opacity={0.8} />
                    )}
                    <circle cx={x} cy={viewMode === "3D" ? y - 22 : y} r={pt.kind === "CITY" ? 6 : 5} fill={color} stroke="#080808" strokeWidth={1.5} />
                    <text x={x + 8} y={(viewMode === "3D" ? y - 22 : y) + 4} fill="#E5E5E5" fontSize="10" fontFamily="sans-serif">
                      {pt.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Spatial Query & Measurement Tool */}
          <div className="sg-card">
            <div className="sg-eyebrow" style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.5rem" }}>
              <Ruler size={13} /> Spatial Distance &amp; Coverage Query
            </div>
            <div className="sg-grid-3">
              <div>
                <label className="sg-label" htmlFor="sp-a">Origin Node</label>
                <select id="sp-a" className="sg-select" value={pointA} onChange={(e) => setPointA(e.target.value)}>
                  {points.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
                </select>
              </div>
              <div>
                <label className="sg-label" htmlFor="sp-b">Target Node</label>
                <select id="sp-b" className="sg-select" value={pointB} onChange={(e) => setPointB(e.target.value)}>
                  {points.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
                </select>
              </div>
              <div>
                <label className="sg-label" htmlFor="sp-rad">Coverage Radius (km)</label>
                <input id="sp-rad" type="number" min={1} max={5000} className="sg-input" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value) || 15)} />
              </div>
            </div>
            <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.88rem" }}>
              <div>
                Geodesic Distance: <strong className="sg-mono" style={{ color: "var(--sg-gold)" }}>{measuredKm !== null ? `${measuredKm.toFixed(2)} km` : "N/A"}</strong>
              </div>
              <div>
                Nodes within {radiusKm} km of Origin: <strong className="sg-mono" style={{ color: "var(--sg-gold)" }}>{nearbyCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
