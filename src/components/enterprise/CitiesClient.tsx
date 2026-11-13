"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe2, Plus, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface CityRow {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  country_name?: string | null;
  region_name: string;
  population: number | null;
  readiness_score: number;
  data_status: string;
  is_public: number;
}

export function CitiesClient({
  initialCities,
  countries,
  canWrite,
}: {
  initialCities: CityRow[];
  countries: { code: string; name: string; default_currency: string; default_timezone: string }[];
  canWrite: boolean;
}) {
  const [cities, setCities] = useState<CityRow[]>(initialCities);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState(countries[0]?.code || "US");
  const [regionName, setRegionName] = useState("");
  const [latitude, setLatitude] = useState("40.7128");
  const [longitude, setLongitude] = useState("-74.0060");
  const [population, setPopulation] = useState("850000");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const filtered = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.region_name.toLowerCase().includes(query.toLowerCase()) ||
      (c.country_name || c.country_code).toLowerCase().includes(query.toLowerCase())
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const country = countries.find((co) => co.code === countryCode);
    const res = await fetch("/api/v1/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        countryCode,
        regionName,
        latitude: Number(latitude),
        longitude: Number(longitude),
        timezone: country?.default_timezone || "UTC",
        currency: country?.default_currency || "USD",
        population: population ? Number(population) : undefined,
        summary: summary || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message || "Failed to register city.");
      return;
    }
    setShowAdd(false);
    setName("");
    setRegionName("");
    setSummary("");
    const updated = await fetch("/api/v1/cities?pageSize=100").then((r) => r.json());
    if (updated.data) setCities(updated.data);
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div className="sg-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="sg-eyebrow">Hierarchical City Registry</div>
          <h1 className="sg-h1" style={{ fontSize: "1.8rem", marginBottom: "0.2rem" }}>Global City Network</h1>
          <p className="sg-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Manage registered tenant cities and inspect public reference profiles across countries and regions.
          </p>
        </div>
        {canWrite && (
          <button type="button" className="sg-btn sg-btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={16} /> Register City
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={onCreate} className="sg-card" style={{ display: "grid", gap: "0.9rem" }}>
          <h2 className="sg-h3">Register Municipal Profile</h2>
          {error && <div className="sg-badge sg-badge-error">{error}</div>}
          <div className="sg-grid sg-grid-3">
            <div>
              <label className="sg-label">City Name</label>
              <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Austin" />
            </div>
            <div>
              <label className="sg-label">Country</label>
              <select className="sg-select" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                {countries.map((co) => (
                  <option key={co.code} value={co.code}>{co.name} ({co.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sg-label">Region / State / Province</label>
              <input className="sg-input" value={regionName} onChange={(e) => setRegionName(e.target.value)} required placeholder="Texas" />
            </div>
            <div>
              <label className="sg-label">Latitude</label>
              <input className="sg-input" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
            </div>
            <div>
              <label className="sg-label">Longitude</label>
              <input className="sg-input" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
            </div>
            <div>
              <label className="sg-label">Population</label>
              <input className="sg-input" type="number" value={population} onChange={(e) => setPopulation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="sg-label">Operational Summary</label>
            <textarea className="sg-textarea" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Primary grid and mobility objectives..." />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="sg-btn sg-btn-primary">Create City Profile</button>
            <button type="button" className="sg-btn sg-btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sg-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Globe2 size={18} style={{ color: "var(--sg-gold)" }} />
            <strong>Registered Profiles ({filtered.length})</strong>
          </div>
          <input
            className="sg-input"
            style={{ maxWidth: "300px" }}
            placeholder="Filter city, region, or country..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="sg-grid sg-grid-3">
          {filtered.map((city) => (
            <Link
              key={city.id}
              href={`/app/cities/${city.slug}`}
              className="sg-card"
              style={{ display: "flex", flexDirection: "column", gap: "0.55rem", background: "var(--bg-elevated)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <span className="sg-eyebrow">{city.country_name || city.country_code} · {city.region_name}</span>
                <StatusBadge status={city.data_status} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "1.15rem", margin: 0 }}>{city.name}</h2>
                <ArrowRight size={15} style={{ color: "var(--sg-gold)" }} />
              </div>
              <div className="sg-muted" style={{ fontSize: "0.82rem" }}>
                Readiness Index: <strong>{city.readiness_score}/100</strong>
                {city.population ? ` · Pop: ${Number(city.population).toLocaleString()}` : ""}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
