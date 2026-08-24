# Ambulance Intelligence Routing (AIR) — Single-City MVP

> **Next-Generation Emergency Medical Services (EMS) Dispatch & Intelligent Routing System**  
> Powered by Real-Time Telemetry, OpenRouteService Road Geometry, Geospatial Pre-Filtering, and Hospital Capacity Balancing.

---

## 🚑 Project Overview

**AIR (Ambulance Intelligence Routing)** is a full-stack emergency dispatch and hospital routing platform built for single-city municipal operations. It bridges 911 dispatchers, active ambulance crews on mobile terminals, and receiving hospital trauma centers into a synchronized real-time operational loop.

### Core Features

1. **Intelligent Geospatial Pre-Filter & ETA Ranking**
   - 30 km spatial bounding radius to identify candidates.
   - Road-network driving calculations powered by **OpenRouteService (ORS)**.
   - Severity-weighted ranking engine balancing real road ETA, emergency triage urgency (*Level 1 Resuscitation* through *Level 5 Non-Urgent*), and vehicle capability (*Critical Care / ALS / BLS*).

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

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Leaflet / React-Leaflet, Lucide Icons
- **Backend**: Node.js, Express, TypeScript (TSX execution)
- **Routing Engine**: OpenRouteService (Directions & Matrix API) with high-resilient road grid fallback
- **Real-Time Communication**: Socket.IO bi-directional rooms (`dispatcher`, `driver`, `hospital`)
- **Database & Cache**: In-memory relational state engine + Redis short-TTL routing cache

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
OPENROUTESERVICE_API_KEY=your_optional_ors_api_key
ROUTING_PROVIDER=openrouteservice
```
*(Note: If no OpenRouteService API key is provided, the application automatically uses the built-in resilient street routing fallback).*

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
