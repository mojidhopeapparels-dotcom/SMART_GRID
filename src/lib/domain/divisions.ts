export interface DivisionDefinition {
  number: number;
  code: string;
  slug: string;
  name: string;
  category:
    | "Governance & Spatial"
    | "Mobility & Infrastructure"
    | "Environment & Utilities"
    | "Safety, Health & Urban"
    | "Economy & Community";
  purpose: string;
  description: string;
  capabilities: string[];
  exampleDatasets: string[];
  kpis: { code: string; name: string; unit: string; description: string }[];
  relatedDivisions: string[];
  guardrails: string[];
  domainFocusLabel: string;
  primaryEntityType: string;
}

export const DIVISIONS: DivisionDefinition[] = [
  {
    number: 1,
    code: "01",
    slug: "city-governance-and-command",
    name: "City Governance & Command",
    category: "Governance & Spatial",
    purpose: "Provide authorized leaders with a structured overview of city performance and governance operations.",
    description:
      "Unifies strategic objectives, interdepartmental coordination, policy initiatives, approval records, and executive reporting with explicit distinction between official and internal records.",
    capabilities: [
      "City leadership dashboard",
      "Department directory & performance summaries",
      "Strategic objective & policy initiative tracking",
      "Decision & approval records",
      "Public transparency links for approved records",
    ],
    exampleDatasets: [
      "Department service indicators",
      "Strategic plan milestones",
      "Public service response metrics",
    ],
    kpis: [
      { code: "GOV-01", name: "Strategic Milestone Completion", unit: "%", description: "Share of scheduled city strategic milestones marked verified complete." },
      { code: "GOV-02", name: "Interdepartmental SLA Adherence", unit: "%", description: "Cross-agency coordination items resolved within target window." },
      { code: "GOV-03", name: "Public Record Transparency Ratio", unit: "%", description: "Approved governance datasets published to Open Data Center." },
    ],
    relatedDivisions: ["digital-twin-and-geospatial-intelligence", "municipal-finance-and-procurement", "citizen-services-and-community"],
    guardrails: [
      "Clearly identify official versus internal draft records.",
      "Do not infer legal or policy conclusions from incomplete data.",
      "Restrict confidential decision records by organization role.",
    ],
    domainFocusLabel: "Strategic Objectives & Decisions",
    primaryEntityType: "governance_initiatives",
  },
  {
    number: 2,
    code: "02",
    slug: "digital-twin-and-geospatial-intelligence",
    name: "Digital Twin & Geospatial Intelligence",
    category: "Governance & Spatial",
    purpose: "Provide spatial context for city assets, services, boundaries, and approved models.",
    description:
      "Manages 2D/3D spatial layers, administrative boundaries, coordinate reference metadata, spatial joins, proximity analysis, and scenario overlays.",
    capabilities: [
      "2D & 3D spatial exploration where licensed geometry exists",
      "Administrative boundary & GIS layer manager",
      "Distance, area, coverage & hotspot analysis",
      "Time-based map comparison & scenario overlays",
    ],
    exampleDatasets: [
      "Administrative boundaries (GeoJSON)",
      "Critical facility coordinates",
      "Elevation & land parcel footprints",
    ],
    kpis: [
      { code: "GIS-01", name: "Verified Spatial Layer Coverage", unit: "%", description: "City geographic area covered by validated CRS-checked layers." },
      { code: "GIS-02", name: "Asset Geolocation Completeness", unit: "%", description: "Registered assets with verified coordinate geometry." },
    ],
    relatedDivisions: ["urban-planning-and-development", "iot-and-sensor-networks", "disaster-and-climate-risk"],
    guardrails: [
      "Disclose coordinate reference system, source, and accuracy metadata.",
      "Do not claim full 3D city model coverage where source geometry is absent.",
    ],
    domainFocusLabel: "Spatial Layers & Geometry Quality",
    primaryEntityType: "gis_layers",
  },
  {
    number: 3,
    code: "03",
    slug: "traffic-and-mobility",
    name: "Traffic & Mobility",
    category: "Mobility & Infrastructure",
    purpose: "Analyze road network performance, congestion patterns, travel times, and roadway incidents.",
    description:
      "Tracks corridor speeds, volume counts, roadwork closures, incident hotspots, and historical mobility comparisons without claiming live telemetry unless an active feed is connected.",
    capabilities: [
      "Road segment profiles & traffic count datasets",
      "Travel-time index & congestion duration tracking",
      "Road incident & roadwork coordination",
      "Traffic hotspot mapping & historical comparison",
    ],
    exampleDatasets: [
      "Corridor speed & volume observations",
      "Road incident logs",
      "Scheduled roadwork permits",
    ],
    kpis: [
      { code: "TRF-01", name: "Mean Corridor Speed", unit: "km/h", description: "Observed average speed across monitored arterial segments." },
      { code: "TRF-02", name: "Travel Time Index", unit: "ratio", description: "Peak travel time divided by free-flow baseline travel time." },
      { code: "TRF-03", name: "Active Road Incidents", unit: "count", description: "Open verified roadway disruption records." },
    ],
    relatedDivisions: ["public-transit-and-transportation", "logistics-and-supply-chain", "public-lighting-and-street-infrastructure"],
    guardrails: [
      "Never label sample or historical counts as live traffic.",
      "Clearly separate observed counts from modeled forecasts.",
    ],
    domainFocusLabel: "Corridor Speed & Road Incidents",
    primaryEntityType: "mobility_corridors",
  },
  {
    number: 4,
    code: "04",
    slug: "public-transit-and-transportation",
    name: "Public Transit & Transportation",
    category: "Mobility & Infrastructure",
    purpose: "Monitor transit routes, schedules, stop accessibility, ridership, and service disruptions.",
    description:
      "Supports GTFS static schedules, optional authorized GTFS-Realtime feeds, ridership analytics, and first/last-mile station accessibility coverage.",
    capabilities: [
      "Transit agency, route, line & stop registry",
      "Timetable, headway & service availability views",
      "Ridership trend & mode comparison analysis",
      "First/last-mile & accessibility coverage mapping",
    ],
    exampleDatasets: [
      "GTFS static route & stop feeds",
      "Historical station ridership totals",
      "Service disruption bulletins",
    ],
    kpis: [
      { code: "TRN-01", name: "On-Time Service Adherence", unit: "%", description: "Scheduled trips arriving within agency tolerance window." },
      { code: "TRN-02", name: "Accessible Stop Coverage", unit: "%", description: "Registered transit stops with verified step-free access metadata." },
    ],
    relatedDivisions: ["traffic-and-mobility", "urban-planning-and-development", "education-and-social-infrastructure"],
    guardrails: [
      "Mark GTFS-Realtime as INTEGRATION REQUIRED when no agency feed is connected.",
    ],
    domainFocusLabel: "Routes, Headways & Accessibility",
    primaryEntityType: "transit_routes",
  },
  {
    number: 5,
    code: "05",
    slug: "environment-and-air-quality",
    name: "Environment & Air Quality",
    category: "Environment & Utilities",
    purpose: "Track air pollutants, monitoring station health, and environmental quality indicators.",
    description:
      "Records PM2.5, PM10, NO2, O3, SO2, and CO observations with explicit unit, timestamp, station calibration status, and source attribution.",
    capabilities: [
      "Monitoring station registry & health status",
      "Multi-pollutant time-series & threshold alerts",
      "Geographic dispersion & source comparison",
      "Historical environmental compliance reports",
    ],
    exampleDatasets: [
      "Station particulate readings (PM2.5, PM10)",
      "Trace gas concentrations (NO2, O3, SO2, CO)",
    ],
    kpis: [
      { code: "ENV-01", name: "Mean PM2.5 Concentration", unit: "ug/m3", description: "Average fine particulate concentration across reporting stations." },
      { code: "ENV-02", name: "Monitoring Station Uptime", unit: "%", description: "Active stations reporting within expected sync interval." },
    ],
    relatedDivisions: ["weather-and-climate", "iot-and-sensor-networks", "healthcare-and-medical-infrastructure"],
    guardrails: [
      "Every pollutant value must display unit, timestamp, station ID, and quality status.",
    ],
    domainFocusLabel: "Stations & Pollutant Observations",
    primaryEntityType: "air_stations",
  },
  {
    number: 6,
    code: "06",
    slug: "weather-and-climate",
    name: "Weather & Climate",
    category: "Environment & Utilities",
    purpose: "Track observed meteorological conditions, climate normals, and authorized forecast feeds.",
    description:
      "Distinguishes observed station weather, third-party forecast values, long-term climate averages, and scenario projections.",
    capabilities: [
      "Temperature, rainfall, humidity & wind trends",
      "Extreme weather event archive & timeline",
      "Seasonal anomaly & climate risk overlays",
    ],
    exampleDatasets: [
      "Historical meteorological station logs",
      "Monthly precipitation normals",
    ],
    kpis: [
      { code: "WTH-01", name: "24h Cumulative Precipitation", unit: "mm", description: "Measured rainfall accumulation across meteorological gauges." },
      { code: "WTH-02", name: "Heat Index Anomaly", unit: "degC", description: "Deviation against 30-year baseline temperature record." },
    ],
    relatedDivisions: ["disaster-and-climate-risk", "environment-and-air-quality", "water-and-wastewater"],
    guardrails: [
      "Clearly label observed weather vs forecast vs climate averages.",
    ],
    domainFocusLabel: "Observations vs Climate Baselines",
    primaryEntityType: "weather_observations",
  },
  {
    number: 7,
    code: "07",
    slug: "energy-and-power-grid",
    name: "Energy & Power Grid",
    category: "Environment & Utilities",
    purpose: "Analyze grid assets, energy consumption, renewable mix, and outage intelligence.",
    description:
      "Tracks substations, generation metadata, demand profiles, outages, and efficiency projects. Strictly operates as an intelligence layer—never direct SCADA switching.",
    capabilities: [
      "Substation, transformer & generation asset registry",
      "Consumption trend & peak demand analysis",
      "Outage tracking & renewable share KPIs",
    ],
    exampleDatasets: [
      "Feeder load profiles",
      "Substation outage logs",
      "Renewable generation capacity",
    ],
    kpis: [
      { code: "ENG-01", name: "Renewable Generation Share", unit: "%", description: "Portion of reported supply attributed to renewable sources." },
      { code: "ENG-02", name: "SAIDI Outage Duration", unit: "min", description: "Average interruption duration per served customer in period." },
    ],
    relatedDivisions: ["buildings-and-housing", "public-lighting-and-street-infrastructure", "iot-and-sensor-networks"],
    guardrails: [
      "SAFETY BOUNDARY: Physical grid control or switching is outside SMART GRID scope.",
    ],
    domainFocusLabel: "Grid Load, Outages & Renewables",
    primaryEntityType: "energy_assets",
  },
  {
    number: 8,
    code: "08",
    slug: "water-and-wastewater",
    name: "Water & Wastewater",
    category: "Environment & Utilities",
    purpose: "Monitor water supply facilities, quality records, distribution coverage, and leakage incidents.",
    description:
      "Covers treatment plants, pumping stations, reservoir capacity, water quality testing, non-revenue water loss, and maintenance work orders.",
    capabilities: [
      "Treatment plant & pipeline asset registry",
      "Water quality & pressure monitoring records",
      "Leakage incident & service interruption tracking",
    ],
    exampleDatasets: [
      "Treatment plant daily output",
      "Distribution quality lab samples",
      "Main break & leakage work orders",
    ],
    kpis: [
      { code: "WAT-01", name: "Water Quality Compliance", unit: "%", description: "Samples meeting regulatory turbidity and residual standards." },
      { code: "WAT-02", name: "Non-Revenue Water Loss", unit: "%", description: "Estimated distribution loss between production and metered use." },
    ],
    relatedDivisions: ["weather-and-climate", "waste-and-sanitation", "disaster-and-climate-risk"],
    guardrails: [
      "Intelligence layer only; treatment plant control remains with utility SCADA systems.",
    ],
    domainFocusLabel: "Supply Quality & Distribution Loss",
    primaryEntityType: "water_facilities",
  },
  {
    number: 9,
    code: "09",
    slug: "waste-and-sanitation",
    name: "Waste & Sanitation",
    category: "Environment & Utilities",
    purpose: "Optimize collection coverage, recycling diversion rates, and sanitation facility operations.",
    description:
      "Coordinates collection zone schedules, transfer stations, diversion metrics, and citizen sanitation complaints.",
    capabilities: [
      "Waste facility & collection zone registry",
      "Waste generation & recycling diversion indicators",
      "Collection route coverage & complaint tracking",
    ],
    exampleDatasets: [
      "Monthly tonnage by waste stream",
      "Collection zone adherence logs",
    ],
    kpis: [
      { code: "WST-01", name: "Waste Diversion Rate", unit: "%", description: "Share of municipal waste diverted to recycling or composting." },
      { code: "WST-02", name: "Collection Route Completion", unit: "%", description: "Scheduled collection routes completed within SLA window." },
    ],
    relatedDivisions: ["environment-and-air-quality", "water-and-wastewater", "citizen-services-and-community"],
    guardrails: [
      "Disclose estimation methodology when tonnage is sampled rather than weighed.",
    ],
    domainFocusLabel: "Diversion Rates & Collection Zones",
    primaryEntityType: "waste_zones",
  },
  {
    number: 10,
    code: "10",
    slug: "disaster-and-climate-risk",
    name: "Disaster & Climate Risk",
    category: "Safety, Health & Urban",
    purpose: "Map hazard exposure, resilience projects, and historical disaster impacts.",
    description:
      "Supports flood/heat risk overlays, critical facility exposure scoring, preparedness tracking, and post-event assessments without replacing official emergency authorities.",
    capabilities: [
      "Hazard layer catalog (flood, urban heat, seismic)",
      "Critical facility exposure & vulnerability analysis",
      "Preparedness & recovery project tracking",
    ],
    exampleDatasets: [
      "Floodplain inundation polygons",
      "Historical disaster event archive",
    ],
    kpis: [
      { code: "RSK-01", name: "Critical Assets in High-Hazard Zones", unit: "count", description: "Registered critical assets intersecting mapped hazard polygons." },
      { code: "RSK-02", name: "Preparedness Action Completion", unit: "%", description: "Completed resilience milestones across vulnerable districts." },
    ],
    relatedDivisions: ["weather-and-climate", "public-safety-and-emergency-services", "digital-twin-and-geospatial-intelligence"],
    guardrails: [
      "Does not replace official emergency alert agencies or issue unverified public warnings.",
    ],
    domainFocusLabel: "Hazard Exposure & Resilience",
    primaryEntityType: "hazard_zones",
  },
  {
    number: 11,
    code: "11",
    slug: "public-safety-and-emergency-services",
    name: "Public Safety & Emergency Services",
    category: "Safety, Health & Urban",
    purpose: "Track safety facility coverage, preparedness readiness, and authorized aggregate incident trends.",
    description:
      "Maintains fire, rescue, and emergency station directories, response coverage zones, and strictly access-controlled aggregate operational indicators.",
    capabilities: [
      "Fire, rescue & safety facility directory",
      "Emergency response coverage & capacity mapping",
      "Authorized aggregate incident trend analysis",
    ],
    exampleDatasets: [
      "Emergency station locations & readiness metadata",
      "Approved aggregate public incident summaries",
    ],
    kpis: [
      { code: "SAF-01", name: "5-Minute Station Coverage", unit: "%", description: "Estimated population within 5-minute travel radius of active stations." },
      { code: "SAF-02", name: "Unit Readiness Availability", unit: "%", description: "Registered emergency response units reporting operational readiness." },
    ],
    relatedDivisions: ["disaster-and-climate-risk", "healthcare-and-medical-infrastructure", "traffic-and-mobility"],
    guardrails: [
      "Strict privacy and public-disclosure review required; never expose sensitive operational details publicly.",
      "Does not replace CAD / 911 / 999 emergency dispatch systems.",
    ],
    domainFocusLabel: "Coverage Zones & Readiness",
    primaryEntityType: "safety_facilities",
  },
  {
    number: 12,
    code: "12",
    slug: "healthcare-and-medical-infrastructure",
    name: "Healthcare & Medical Infrastructure",
    category: "Safety, Health & Urban",
    purpose: "Analyze healthcare facility distribution, infrastructure capacity, and geographic service access.",
    description:
      "Tracks clinics, hospitals, pharmacies, and public health infrastructure coverage while explicitly prohibiting identifiable patient medical records.",
    capabilities: [
      "Healthcare facility registry & service categories",
      "Geographic access & bed/capacity metadata",
      "Healthcare capital project & maintenance tracking",
    ],
    exampleDatasets: [
      "Hospital & clinic facility locations",
      "Aggregate facility capacity snapshots",
    ],
    kpis: [
      { code: "HLT-01", name: "Primary Care Access Coverage", unit: "%", description: "Population within 15 minutes of a registered primary care facility." },
      { code: "HLT-02", name: "Facility Infrastructure Readiness", unit: "%", description: "Healthcare facilities with up-to-date backup power & maintenance checks." },
    ],
    relatedDivisions: ["environment-and-air-quality", "public-safety-and-emergency-services", "education-and-social-infrastructure"],
    guardrails: [
      "PROHIBITED: Do not store identifiable patient medical records (PHI) in SMART GRID.",
    ],
    domainFocusLabel: "Facility Access & Capacity",
    primaryEntityType: "health_facilities",
  },
  {
    number: 13,
    code: "13",
    slug: "urban-planning-and-development",
    name: "Urban Planning & Development",
    category: "Safety, Health & Urban",
    purpose: "Coordinate zoning layers, land-use changes, development pipelines, and urban growth scenarios.",
    description:
      "Connects parcel zoning, active development permits, density analysis, and infrastructure capacity checks across expanding districts.",
    capabilities: [
      "Land-use & zoning GIS layers",
      "Development project & planning application registry",
      "Urban growth & infrastructure capacity analysis",
    ],
    exampleDatasets: [
      "Municipal zoning polygons",
      "Active major development permits",
    ],
    kpis: [
      { code: "URB-01", name: "Transit-Oriented Development Share", unit: "%", description: "Approved new residential units within 800m of high-capacity transit." },
      { code: "URB-02", name: "Permit Review Cycle Time", unit: "days", description: "Median calendar days from planning submission to determination." },
    ],
    relatedDivisions: ["buildings-and-housing", "digital-twin-and-geospatial-intelligence", "public-transit-and-transportation"],
    guardrails: [
      "Clearly distinguish adopted zoning law from proposed planning scenarios.",
    ],
    domainFocusLabel: "Zoning, Density & Development",
    primaryEntityType: "planning_zones",
  },
  {
    number: 14,
    code: "14",
    slug: "buildings-and-housing",
    name: "Buildings & Housing",
    category: "Safety, Health & Urban",
    purpose: "Track building stock, housing inventory, energy performance, and structural condition metadata.",
    description:
      "Maintains municipal and civic building registries, housing affordability indicators, permit activity, and energy benchmarking.",
    capabilities: [
      "Building footprint & use-category registry",
      "Housing inventory & affordability indicators",
      "Building condition & energy performance tracking",
    ],
    exampleDatasets: [
      "Civic building asset register",
      "District housing stock & permit counts",
    ],
    kpis: [
      { code: "BLD-01", name: "Civic Building Energy Intensity", unit: "kWh/m2", description: "Annual energy consumption per square meter of municipal buildings." },
      { code: "BLD-02", name: "Affordable Housing Pipeline", unit: "units", description: "Permitted or under-construction regulated affordable housing units." },
    ],
    relatedDivisions: ["urban-planning-and-development", "energy-and-power-grid", "economy-and-commerce"],
    guardrails: [
      "Respect residential privacy when aggregating permit or utility data.",
    ],
    domainFocusLabel: "Building Stock & Housing",
    primaryEntityType: "buildings",
  },
  {
    number: 15,
    code: "15",
    slug: "iot-and-sensor-networks",
    name: "IoT & Sensor Networks",
    category: "Mobility & Infrastructure",
    purpose: "Manage urban sensor registries, ingestion health, calibration logs, and time-series observations.",
    description:
      "Provides device-to-asset linkage, telemetry freshness monitoring, missing-data alerts, and calibration traceability across divisions.",
    capabilities: [
      "Sensor device registry & asset linkage",
      "Ingestion freshness & missing-data alerting",
      "Calibration history & observation explorer",
    ],
    exampleDatasets: [
      "Registered sensor inventory",
      "Time-series telemetry observations",
    ],
    kpis: [
      { code: "IOT-01", name: "Active Reporting Sensors", unit: "%", description: "Registered sensors reporting valid observations within heartbeat SLA." },
      { code: "IOT-02", name: "Calibration Currency", unit: "%", description: "Devices within scheduled calibration validity period." },
    ],
    relatedDivisions: ["environment-and-air-quality", "digital-twin-and-geospatial-intelligence", "telecommunications-and-connectivity"],
    guardrails: [
      "Every reading must carry source ID, unit, timestamp, and quality flag.",
    ],
    domainFocusLabel: "Device Fleet & Telemetry Health",
    primaryEntityType: "sensors",
  },
  {
    number: 16,
    code: "16",
    slug: "telecommunications-and-connectivity",
    name: "Telecommunications & Connectivity",
    category: "Mobility & Infrastructure",
    purpose: "Analyze broadband availability, public Wi-Fi coverage, and digital inclusion gaps.",
    description:
      "Maps fiber corridors, public access points, and connectivity gap indicators without claiming access to private carrier internals.",
    capabilities: [
      "Public Wi-Fi & civic connectivity registry",
      "Broadband availability & digital gap mapping",
      "Infrastructure resilience & project tracking",
    ],
    exampleDatasets: [
      "Municipal Wi-Fi hotspot directory",
      "District broadband speed tier surveys",
    ],
    kpis: [
      { code: "TEL-01", name: "Civic Wi-Fi Availability", unit: "%", description: "Operational uptime of municipal public Wi-Fi access points." },
      { code: "TEL-02", name: "High-Speed Coverage Gap", unit: "%", description: "Neighborhoods below target broadband benchmark." },
    ],
    relatedDivisions: ["iot-and-sensor-networks", "education-and-social-infrastructure", "economy-and-commerce"],
    guardrails: [
      "Do not imply access to private telecom operator internal traffic or subscriber records.",
    ],
    domainFocusLabel: "Broadband Gaps & Public Access",
    primaryEntityType: "connectivity_nodes",
  },
  {
    number: 17,
    code: "17",
    slug: "logistics-and-supply-chain",
    name: "Logistics & Supply Chain",
    category: "Mobility & Infrastructure",
    purpose: "Monitor freight corridors, distribution hubs, port/terminal operations, and supply disruptions.",
    description:
      "Coordinates urban freight routes, loading zone access, cold-chain facilities, and supply disruption resilience.",
    capabilities: [
      "Warehouse, port & freight hub registry",
      "Freight corridor & disruption tracking",
      "Facility access & modal transfer analysis",
    ],
    exampleDatasets: [
      "Designated urban freight corridors",
      "Port & intermodal terminal throughput logs",
    ],
    kpis: [
      { code: "LOG-01", name: "Freight Corridor Reliability", unit: "%", description: "On-schedule corridor traversal within benchmark window." },
      { code: "LOG-02", name: "Active Supply Disruptions", unit: "count", description: "Open logged corridor or hub disruption incidents." },
    ],
    relatedDivisions: ["traffic-and-mobility", "food-systems-and-urban-agriculture", "economy-and-commerce"],
    guardrails: [
      "Respect commercial confidentiality on private carrier shipment data.",
    ],
    domainFocusLabel: "Freight Corridors & Hubs",
    primaryEntityType: "logistics_hubs",
  },
  {
    number: 18,
    code: "18",
    slug: "economy-and-commerce",
    name: "Economy & Commerce",
    category: "Economy & Community",
    purpose: "Track commercial activity, employment indicators, business density, and local economic trends.",
    description:
      "Synthesizes licensed economic statistics, commercial zone profiles, business registration counts, and development investments.",
    capabilities: [
      "Economic indicator & commercial district catalog",
      "Business registration & employment trend analysis",
      "Multi-city economic benchmarking",
    ],
    exampleDatasets: [
      "Quarterly district employment statistics",
      "Commercial license issuance counts",
    ],
    kpis: [
      { code: "ECO-01", name: "Net New Business Registrations", unit: "count", description: "New commercial registrations minus closures in period." },
      { code: "ECO-02", name: "Commercial Occupancy Rate", unit: "%", description: "Occupied ground-floor commercial units in tracked districts." },
    ],
    relatedDivisions: ["municipal-finance-and-procurement", "urban-planning-and-development", "tourism-culture-and-recreation"],
    guardrails: [
      "Respect data licensing and never publish confidential business financial filings.",
    ],
    domainFocusLabel: "District Commerce & Employment",
    primaryEntityType: "economic_indicators",
  },
  {
    number: 19,
    code: "19",
    slug: "municipal-finance-and-procurement",
    name: "Municipal Finance & Procurement",
    category: "Economy & Community",
    purpose: "Track approved budgets, procurement plans, tenders, contracts, and vendor performance.",
    description:
      "Provides strict role-gated budget-vs-actual visibility, tender pipeline tracking, and auditable vendor contract milestones—distinct from certified ERP accounting.",
    capabilities: [
      "Approved budget categories & variance tracking",
      "Procurement plan, tender & contract registry",
      "Vendor compliance & milestone audit links",
    ],
    exampleDatasets: [
      "Adopted annual capital budget allocations",
      "Public procurement tender & award registry",
    ],
    kpis: [
      { code: "FIN-01", name: "Capital Budget Execution", unit: "%", description: "Expended or encumbered share of approved capital budget." },
      { code: "FIN-02", name: "Competitive Tender Ratio", unit: "%", description: "Share of procurement awards issued via open competitive tender." },
    ],
    relatedDivisions: ["city-governance-and-command", "economy-and-commerce"],
    guardrails: [
      "Requires strict RBAC and audit trail; SMART GRID is not a certified statutory accounting ledger.",
    ],
    domainFocusLabel: "Budgets, Tenders & Contracts",
    primaryEntityType: "procurement_contracts",
  },
  {
    number: 20,
    code: "20",
    slug: "citizen-services-and-community",
    name: "Citizen Services & Community",
    category: "Economy & Community",
    purpose: "Coordinate public service directories, service request intake, routing, and community surveys.",
    description:
      "Routes citizen requests to responsible divisions, tracks SLA response times, and summarizes community feedback with anti-abuse protections.",
    capabilities: [
      "Public service directory & request intake",
      "Department routing & response-time analytics",
      "Community survey builder & engagement reports",
    ],
    exampleDatasets: [
      "311 / public service request tickets",
      "Community consultation survey responses",
    ],
    kpis: [
      { code: "CIT-01", name: "Median Request Resolution Time", unit: "hours", description: "Median time from service intake to verified resolution." },
      { code: "CIT-02", name: "Citizen Satisfaction Score", unit: "score/5", description: "Weighted mean rating from verified post-resolution feedback." },
    ],
    relatedDivisions: ["city-governance-and-command", "waste-and-sanitation", "public-lighting-and-street-infrastructure"],
    guardrails: [
      "Moderate submissions and redact personal contact info from public views.",
    ],
    domainFocusLabel: "Service Requests & Engagement",
    primaryEntityType: "service_requests",
  },
  {
    number: 21,
    code: "21",
    slug: "education-and-social-infrastructure",
    name: "Education & Social Infrastructure",
    category: "Economy & Community",
    purpose: "Analyze schools, libraries, community centers, capacity, and equitable geographic access.",
    description:
      "Maps educational and social facilities against population distribution to identify underserved neighborhoods and capital needs.",
    capabilities: [
      "School, university, library & community registry",
      "Geographic access & capacity gap analysis",
      "Social infrastructure project & accessibility tracking",
    ],
    exampleDatasets: [
      "Public school & library locations",
      "Facility enrollment vs design capacity",
    ],
    kpis: [
      { code: "EDU-01", name: "Walkable Library Access", unit: "%", description: "Residents within 15-minute walk of a public library or learning hub." },
      { code: "EDU-02", name: "Facility Accessibility Compliance", unit: "%", description: "Public learning facilities meeting physical accessibility standards." },
    ],
    relatedDivisions: ["healthcare-and-medical-infrastructure", "public-transit-and-transportation", "telecommunications-and-connectivity"],
    guardrails: [
      "Never store student-level personally identifiable educational records.",
    ],
    domainFocusLabel: "Schools, Libraries & Access",
    primaryEntityType: "social_facilities",
  },
  {
    number: 22,
    code: "22",
    slug: "public-lighting-and-street-infrastructure",
    name: "Public Lighting & Street Infrastructure",
    category: "Mobility & Infrastructure",
    purpose: "Manage streetlights, street furniture, fault outages, energy conversion, and inspections.",
    description:
      "Tracks luminaire inventory, LED/smart-dimming status, outage work orders, and street infrastructure replacement planning.",
    capabilities: [
      "Streetlight & street asset inventory",
      "Fault/outage records & inspection schedules",
      "LED energy efficiency & replacement planning",
    ],
    exampleDatasets: [
      "Streetlight pole & luminaire GIS inventory",
      "Lighting outage work order logs",
    ],
    kpis: [
      { code: "LGT-01", name: "LED Conversion Ratio", unit: "%", description: "Share of municipal streetlights upgraded to high-efficiency LED." },
      { code: "LGT-02", name: "Lighting Fault Resolution Time", unit: "hours", description: "Mean time to repair reported streetlight outages." },
    ],
    relatedDivisions: ["energy-and-power-grid", "traffic-and-mobility", "public-safety-and-emergency-services"],
    guardrails: [
      "Distinguish automated controller telemetry from manually reported outages.",
    ],
    domainFocusLabel: "Luminaires, Outages & LED Efficiency",
    primaryEntityType: "lighting_assets",
  },
  {
    number: 23,
    code: "23",
    slug: "tourism-culture-and-recreation",
    name: "Tourism, Culture & Recreation",
    category: "Economy & Community",
    purpose: "Coordinate cultural venues, parks, green spaces, event calendars, and accessibility metadata.",
    description:
      "Maintains park access equity metrics, cultural asset directories, seasonal visitor indicators, and city event calendars.",
    capabilities: [
      "Parks, cultural venues & attraction directory",
      "Green space access & event calendar integration",
      "Licensed visitor trend & accessibility reports",
    ],
    exampleDatasets: [
      "Public park boundaries & amenities",
      "Cultural event calendar",
    ],
    kpis: [
      { code: "TUR-01", name: "10-Minute Park Access", unit: "%", description: "Urban population within a 10-minute walk of public green space." },
      { code: "TUR-02", name: "Cultural Venue Accessibility", unit: "%", description: "Registered cultural venues with published accessibility guides." },
    ],
    relatedDivisions: ["economy-and-commerce", "public-transit-and-transportation", "urban-planning-and-development"],
    guardrails: [
      "Use only licensed visitor/footfall datasets; never invent visitor counts.",
    ],
    domainFocusLabel: "Parks, Culture & Green Access",
    primaryEntityType: "cultural_sites",
  },
  {
    number: 24,
    code: "24",
    slug: "food-systems-and-urban-agriculture",
    name: "Food Systems & Urban Agriculture",
    category: "Environment & Utilities",
    purpose: "Track food markets, distribution resilience, urban farms, and neighborhood food access.",
    description:
      "Maps wholesale markets, cold storage hubs, urban agriculture parcels, food desert gaps, and licensed staple market price trends.",
    capabilities: [
      "Food market, cold-storage & urban farm registry",
      "Neighborhood food access & resilience analysis",
      "Licensed market price & supply disruption tracking",
    ],
    exampleDatasets: [
      "Public market & urban farm locations",
      "Neighborhood fresh-food access index",
    ],
    kpis: [
      { code: "FOD-01", name: "Fresh Food Access Coverage", unit: "%", description: "Households within 1km of a registered fresh-food market or outlet." },
      { code: "FOD-02", name: "Active Urban Agriculture Area", unit: "ha", description: "Verified hectares of community gardens and urban farming parcels." },
    ],
    relatedDivisions: ["logistics-and-supply-chain", "water-and-wastewater", "waste-and-sanitation"],
    guardrails: [
      "Label market price series with source agency, date, and licensing status.",
    ],
    domainFocusLabel: "Markets, Urban Farms & Food Access",
    primaryEntityType: "food_sites",
  },
];

export function getDivisionBySlug(slug: string): DivisionDefinition | undefined {
  return DIVISIONS.find((d) => d.slug === slug);
}

export function getDivisionByCode(code: string): DivisionDefinition | undefined {
  return DIVISIONS.find((d) => d.code === code || String(d.number) === code);
}
