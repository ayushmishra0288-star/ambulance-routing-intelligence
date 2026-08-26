# Ambulance Intelligence Routing (AIR) — Single-City MVP

> **Next-Generation Emergency Medical Services (EMS) Dispatch & Intelligent Routing System**  
> Powered by Real-Time Telemetry, Google Maps Live Traffic, Road-Network Routing, Geospatial Pre-Filtering, and Hospital Capacity Balancing.

---

## 🚑 Project Overview

**AIR (Ambulance Intelligence Routing)** is a full-stack emergency dispatch and hospital routing platform built for single-city municipal operations. It bridges 911 dispatchers, active ambulance crews on mobile terminals, and receiving hospital trauma centers into a synchronized real-time operational loop.

### Core Features

1. **Intelligent Geospatial Pre-Filter & ETA Ranking**
   - 30 km spatial bounding radius to identify candidates.
   - Road-network ETA and directions through **OpenRouteService → OSRM → geometric urban-grid fallback**.
   - A transparent 100-point ranking engine balancing ETA, incident severity, and vehicle capability (*Critical Care / Advanced / Basic*).

2. **Dispatcher Console**
   - Interactive 911 intake queue with 1-click clinical presets (*STEMI*, *Trauma*, *Stroke*, *Fracture*).
   - Automated hospital specialty matching (*Cath Lab, Trauma Level I/II, Stroke Center*).
   - Live interactive map with active unit trajectories and incident markers.

3. **Driver Mobile PWA Terminal**
   - Turn-by-turn navigation cards and road route polylines.
   - 5-step status progression (*Assigned → En Route → On Scene → Transporting → At Hospital → Completed*).
   - Automated cruise simulation mode and browser GPS streaming.

4. **Hospital Intake & Capacity Portal**
   - Inbound ambulance radar with live ETA countdowns.
   - 1-click bay handover (*Resuscitation Bay 1, Cath Lab Prep, Stroke Bay*).
   - Real-time facility capacity controls (*Normal, High, Diverted, Full*) and bed counters.

5. **Immutable Audit Trail & Fleet Operations**
   - Mandatory audit logging on all status transitions with GPS coordinates and timestamps.
   - Fleet manager for vehicle status overrides and paramedic roster tracking.

---

## 🧠 Algorithms Used

### 1. Geospatial ambulance pre-filter

Only ambulances with status `Available` are considered. The prototype calculates straight-line distance with the **Haversine formula**, equivalent to a PostGIS geography-distance query:

```text
a = sin²(Δlat / 2) + cos(lat₁) × cos(lat₂) × sin²(Δlng / 2)
c = 2 × atan2(√a, √(1 − a))
distance_km = 6371 × c
```

Candidates are filtered to a **30 km radius**, sorted by distance, and limited to the nearest **12 units** before road-network calculations. This avoids sending every ambulance to the routing matrix.

### 2. Road ETA and resilient routing

The routing layer uses this fallback chain:

```text
120-second coordinate cache
        ↓ cache miss
OpenRouteService (4-second timeout)
        ↓ unavailable / invalid response
OSRM using OpenStreetMap roads (3.5-second timeout)
        ↓ unavailable / invalid response
Geometric urban-grid approximation
```

ORS or OSRM returns road distance, duration, route coordinates, and turn-by-turn steps. The geometric fallback estimates:

```text
road_distance_km = haversine_distance_km × 1.35
ETA_seconds = max(45, round((road_distance_km / 38 km/h) × 3600))
```

The `1.35` urban-road factor approximates a street path that is longer than the straight-line distance. Generated full-route fallbacks use a minimum duration of 50 seconds.

### 3. Ambulance matching and ranking

For every shortlisted ambulance, the dispatch engine calculates:

```text
total_score = clamp(proximity_score + equipment_score + availability_score, 1, 100)
```

**Proximity score — up to 55 points**

```text
proximity_score = max(5, round(55 × max(0, 1 − ETA_seconds / 1500)))
```

A lower road ETA produces a higher score. The score reaches its minimum after approximately 25 minutes.

**Equipment score — up to 35 points**

| Incident severity | Critical Care | Advanced | Basic |
|---|---:|---:|---:|
| Level 1 — Resuscitation | 35 | 24 | 8 |
| Level 2 — Emergent | 30 | 30 | 15 |
| Levels 3–5 | 22 | 22 | 30 |

For Levels 3–5, Basic units receive the highest equipment score to conserve Advanced and Critical Care resources for more severe calls. A Basic unit is marked as a sub-optimal equipment match for Level 1 incidents.

**Readiness score — 10 points**

All candidates have already passed the `Available` status filter, so each receives a 10-point readiness score.

Ambulances are sorted by:

1. Highest total match score.
2. Lowest ETA when scores are equal.

### 4. Hospital recommendation

Hospitals are evaluated using road ETA, available capacity, and complaint-to-specialty matching:

- Trauma, collision, or fall → prioritize Level I trauma capability.
- STEMI, chest pain, or cardiac → match cardiology/STEMI or emergency resuscitation.
- Stroke → match a designated stroke specialty.
- `Diverted`, `Full`, or zero-bed facilities are marked as not recommended.
- Remaining hospitals are ranked with recommended facilities first, then by lowest ETA.

### 5. Route lifecycle and re-routing

When a job is assigned, the route is calculated from the ambulance’s current location to the incident. When status changes to `Transporting`, the route is recalculated from the latest ambulance position to the selected hospital. Distance, ETA, polyline coordinates, and navigation steps are replaced with the new hospital route.

Location and status changes are broadcast through Socket.IO and written to the audit trail.

### 6. Hospital intake queue

Inbound jobs are ordered first by clinical severity—Level 1, then Level 2, Level 3, and other levels—and then by the lowest ETA within the same severity group.

### 7. Live traffic visualization

The Google Maps JavaScript API `TrafficLayer` is enabled by default and can be toggled from the map. It displays frequently refreshed traffic conditions where Google provides coverage.

> **Current prototype scope:** live traffic is a visual operational layer. Ambulance scoring and ETA use the routing-provider matrix and do not yet apply Google traffic delays directly.

### Algorithmic complexity

Let `A` be the number of ambulances, `C ≤ 12` the shortlisted candidates, and `H` the number of hospitals:

- Candidate filtering and distance sorting: `O(A log A)`
- Ambulance scoring and ranking: `O(C log C)`
- Hospital evaluation and ranking: `O(H log H)`
- Routing matrix work: `O(C)` for one incident destination and `O(H)` for hospital suggestions

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Google Maps JavaScript API, Lucide Icons
- **Live Traffic**: Google Maps `TrafficLayer` with an on-map ON/OFF control
- **Backend**: Node.js, Express, TypeScript (TSX execution)
- **Routing Engine**: OpenRouteService with OSRM/OpenStreetMap and geometric urban-grid fallbacks
- **Real-Time Communication**: Socket.IO bi-directional rooms (`dispatcher`, `driver`, `hospital`)
- **Database & Cache**: In-memory relational state engine + Redis-style 120-second routing cache

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** (or **bun** / **yarn** / **pnpm**)

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configurable options in `.env`:
```env
PORT=3000
JWT_SECRET=your-secret-key
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_maps_key
OPENROUTESERVICE_API_KEY=your_optional_ors_api_key
ROUTING_PROVIDER=openrouteservice
```
*(If ORS is unavailable or not configured, the application falls back to OSRM and then to its geometric urban-grid estimator. Restrict the Google Maps browser key to the Maps JavaScript API and your allowed HTTP referrers.)*

### 4. Start Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📋 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Express server + Vite middleware on port 3000 with hot reload |
| `npm run build` | Compiles the client app and bundles the server entry point with esbuild |
| `npm start` | Runs the compiled production server (`node dist/server.cjs`) |
| `npm run lint` | Runs TypeScript type checking without emitting files |

---

## 🔄 End-to-End Walkthrough

1. **Dispatcher view**: Select a pending 911 call from the queue (or click **"New 911 Call"**). Review the calculated ETA ranking and hospital recommendation, then click **"Confirm Ambulance Assignment & Push Route"**.
2. **Driver view**: Switch to the **Driver PWA** tab. View the turn-by-turn navigation card and click **"Auto-Drive Cruise Sim"** to watch the vehicle advance along the route. Progress through each mission status step.
3. **Hospital view**: Switch to the **Hospital** tab to see the incoming ambulance in the queue, then click **"Acknowledge & Assign Bay"**.
4. **Reset**: Click the reset button (↺) in the navigation bar anytime to restore the default San Francisco demo scenario.
