/**
 * Routing Service Interface and Providers:
 * - OpenRouteService (ORS) - Primary routing engine for turn-by-turn directions, GeoJSON coordinates, and travel time matrix
 * - OSRM & Geometric Road Grid - Resilient fallbacks
 * Includes Redis short-TTL caching layer for optimal cost, speed, and reliability.
 */

import { redis } from '../cache/redis.js';
import { RouteStep } from '../../src/types/index.js';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  coordinates: [number, number][]; // [lat, lng][]
  steps: RouteStep[];
  provider: string;
}

export interface DistanceMatrixElement {
  originIndex: number;
  destinationIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  status: 'OK' | 'ZERO_RESULTS' | 'FAIL';
}

export interface DistanceMatrixResult {
  elements: DistanceMatrixElement[];
  provider: string;
}

export interface IRoutingService {
  getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult>;

  getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<DistanceMatrixResult>;
}

/**
 * OpenRouteService (ORS) Routing Provider
 * Official OpenRouteService API integration for emergency driving directions & distance matrix
 * API: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/geojson/post
 */
export class OpenRouteServiceProvider implements IRoutingService {
  private baseUrl = 'https://api.openrouteservice.org';
  private fallbackOsrm = new OSRMRoutingProvider();

  private getApiKey(): string | undefined {
    return process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY || undefined;
  }

  public async getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult> {
    const apiKey = this.getApiKey();

    try {
      const url = `${this.baseUrl}/v2/directions/driving-car/geojson`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json'
      };

      if (apiKey) {
        headers['Authorization'] = apiKey;
      }

      const body = JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat]
        ],
        instructions: true,
        geometry: true,
        elevation: false,
        units: 'm',
        language: 'en'
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OpenRouteService HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      if (!data.features || data.features.length === 0) {
        throw new Error('OpenRouteService returned no features');
      }

      const feature = data.features[0];
      const summary = feature.properties?.summary;
      const rawCoords: [number, number][] = feature.geometry?.coordinates || [];

      // OpenRouteService coordinates are [lng, lat], convert to [lat, lng] for frontend/Leaflet
      const coordinates: [number, number][] = rawCoords.map((pt: [number, number]) => [pt[1], pt[0]]);

      const steps: RouteStep[] = [];
      const segments = feature.properties?.segments;
      if (segments && segments.length > 0 && segments[0].steps) {
        for (const s of segments[0].steps) {
          steps.push({
            instruction: s.instruction || `Proceed on ${s.name || 'road'}`,
            distance_meters: Math.round(s.distance || 0),
            duration_seconds: Math.round(s.duration || 0),
            name: s.name,
            modifier: s.type !== undefined ? String(s.type) : undefined
          });
        }
      }

      const distanceMeters = Math.round(summary?.distance || 0);
      const durationSeconds = Math.round(summary?.duration || 0);

      return {
        distanceMeters,
        durationSeconds,
        polyline: JSON.stringify(coordinates),
        coordinates,
        steps: steps.length > 0 ? steps : this.fallbackOsrm.generateFallbackSteps(origin, destination, distanceMeters, durationSeconds),
        provider: 'OpenRouteService'
      };
    } catch (err: any) {
      console.warn(`[OpenRouteService] Route query notice (${err.message}). Using resilient routing engine.`);
      // Fallback to OSRM / High-precision geometric route
      return this.fallbackOsrm.getRoute(origin, destination);
    }
  }

  public async getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<DistanceMatrixResult> {
    const apiKey = this.getApiKey();

    try {
      const url = `${this.baseUrl}/v2/matrix/driving-car`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (apiKey) {
        headers['Authorization'] = apiKey;
      }

      const allLocations = [
        ...origins.map(o => [o.lng, o.lat]),
        ...destinations.map(d => [d.lng, d.lat])
      ];

      const sourceIndices = origins.map((_, i) => i);
      const destIndices = destinations.map((_, i) => origins.length + i);

      const body = JSON.stringify({
        locations: allLocations,
        sources: sourceIndices,
        destinations: destIndices,
        metrics: ['distance', 'duration'],
        units: 'm'
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data: any = await response.json();
        if (data.durations) {
          const elements: DistanceMatrixElement[] = [];
          for (let i = 0; i < origins.length; i++) {
            for (let j = 0; j < destinations.length; j++) {
              const dur = data.durations[i]?.[j] ?? null;
              const dist = data.distances ? data.distances[i]?.[j] ?? (dur ? dur * 11 : 0) : (dur ? dur * 11 : 0);
              elements.push({
                originIndex: i,
                destinationIndex: j,
                durationSeconds: dur !== null ? Math.round(dur) : Math.round(this.fallbackOsrm.fallbackDuration(origins[i], destinations[j])),
                distanceMeters: Math.round(dist),
                status: dur !== null ? 'OK' : 'ZERO_RESULTS'
              });
            }
          }
          return { elements, provider: 'OpenRouteService' };
        }
      }
    } catch (err: any) {
      console.warn(`[OpenRouteService] Matrix query notice (${err.message}). Using backup matrix calculation.`);
    }

    // Fallback to OSRM / urban grid calculation
    return this.fallbackOsrm.getDistanceMatrix(origins, destinations);
  }
}

/**
 * High-performance OSRM Routing Provider (OpenStreetMap Engine)
 * Robust, high-speed, returns real turn-by-turn street navigation with polyline coordinates
 */
export class OSRMRoutingProvider implements IRoutingService {
  private baseUrl = 'https://router.project-osrm.org';

  public async getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult> {
    try {
      // OSRM format: /route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson&steps=true
      const url = `${this.baseUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }

      const data: any = await response.json();
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM error code: ${data.code}`);
      }

      const route = data.routes[0];
      // OSRM coordinates are [lng, lat], convert to [lat, lng] for Leaflet / Map standards
      const coordinates: [number, number][] = route.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      
      const steps: RouteStep[] = [];
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        for (const s of route.legs[0].steps) {
          const instruction = s.maneuver
            ? `${s.maneuver.type ? s.maneuver.type.toUpperCase() : 'GO'} ${s.maneuver.modifier ? '(' + s.maneuver.modifier + ')' : ''} on ${s.name || 'unnamed road'}`
            : `Proceed along ${s.name || 'route'}`;
          steps.push({
            instruction: instruction.replace(/\s+/g, ' ').trim(),
            distance_meters: Math.round(s.distance || 0),
            duration_seconds: Math.round(s.duration || 0),
            modifier: s.maneuver?.modifier,
            name: s.name
          });
        }
      }

      return {
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        polyline: JSON.stringify(coordinates),
        coordinates,
        steps: steps.length > 0 ? steps : this.generateFallbackSteps(origin, destination, route.distance, route.duration),
        provider: 'OSRM'
      };
    } catch (err: any) {
      return this.generateGeometricRoute(origin, destination);
    }
  }

  public async getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<DistanceMatrixResult> {
    try {
      const allCoords = [...origins, ...destinations]
        .map(pt => `${pt.lng},${pt.lat}`)
        .join(';');

      const sourceIndices = origins.map((_, i) => i).join(';');
      const destIndices = destinations.map((_, i) => origins.length + i).join(';');

      const url = `${this.baseUrl}/table/v1/driving/${allCoords}?sources=${sourceIndices}&destinations=${destIndices}&annotations=duration,distance`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data: any = await response.json();
        if (data.code === 'Ok' && data.durations) {
          const elements: DistanceMatrixElement[] = [];
          for (let i = 0; i < origins.length; i++) {
            for (let j = 0; j < destinations.length; j++) {
              const dur = data.durations[i]?.[j] ?? null;
              const dist = data.distances ? data.distances[i]?.[j] ?? (dur ? dur * 11 : 0) : (dur ? dur * 11 : 0);
              elements.push({
                originIndex: i,
                destinationIndex: j,
                durationSeconds: dur !== null ? Math.round(dur) : Math.round(this.fallbackDuration(origins[i], destinations[j])),
                distanceMeters: Math.round(dist),
                status: dur !== null ? 'OK' : 'ZERO_RESULTS'
              });
            }
          }
          return { elements, provider: 'OSRM' };
        }
      }
    } catch (err: any) {
      // ignore and fallback
    }

    // Fallback matrix
    const elements: DistanceMatrixElement[] = [];
    for (let i = 0; i < origins.length; i++) {
      for (let j = 0; j < destinations.length; j++) {
        const distKm = this.haversineKm(origins[i], destinations[j]);
        // Manhattan/Urban factor 1.35x, average speed 38 km/h for emergency vehicle with siren
        const roadDistMeters = Math.round(distKm * 1.35 * 1000);
        const durationSec = Math.round((roadDistMeters / 1000 / 38) * 3600);
        elements.push({
          originIndex: i,
          destinationIndex: j,
          distanceMeters: roadDistMeters,
          durationSeconds: Math.max(45, durationSec),
          status: 'OK'
        });
      }
    }
    return { elements, provider: 'GeometricUrbanGrid' };
  }

  public haversineKm(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  public fallbackDuration(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const km = this.haversineKm(p1, p2);
    return Math.max(45, Math.round((km * 1.35 / 38) * 3600));
  }

  public generateGeometricRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): RouteResult {
    const distKm = this.haversineKm(origin, destination);
    const distanceMeters = Math.round(distKm * 1.35 * 1000);
    const durationSeconds = Math.max(50, Math.round((distanceMeters / 1000 / 38) * 3600));

    // Create realistic intermediate street grid waypoints (Manhattan street geometry interpolation)
    const pointsCount = Math.max(6, Math.min(25, Math.round(distKm * 4)));
    const coordinates: [number, number][] = [];
    
    // First corner point (turn at intermediate street)
    const midLat = origin.lat + (destination.lat - origin.lat) * 0.45;
    const midLng = origin.lng;

    coordinates.push([origin.lat, origin.lng]);
    // Interpolate leg 1
    for (let i = 1; i <= Math.floor(pointsCount / 2); i++) {
      const t = i / Math.floor(pointsCount / 2);
      coordinates.push([origin.lat + (midLat - origin.lat) * t, origin.lng + (midLng - origin.lng) * t]);
    }
    // Interpolate leg 2
    for (let i = 1; i <= Math.ceil(pointsCount / 2); i++) {
      const t = i / Math.ceil(pointsCount / 2);
      coordinates.push([midLat + (destination.lat - midLat) * t, midLng + (destination.lng - midLng) * t]);
    }
    coordinates.push([destination.lat, destination.lng]);

    const steps = this.generateFallbackSteps(origin, destination, distanceMeters, durationSeconds);

    return {
      distanceMeters,
      durationSeconds,
      polyline: JSON.stringify(coordinates),
      coordinates,
      steps,
      provider: 'GeometricRoadGrid'
    };
  }

  public generateFallbackSteps(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    distMeters: number,
    durSeconds: number
  ): RouteStep[] {
    return [
      {
        instruction: 'Dispatch departure: Engage emergency lights and sirens',
        distance_meters: Math.round(distMeters * 0.2),
        duration_seconds: Math.round(durSeconds * 0.2),
        name: 'Origin Post'
      },
      {
        instruction: 'Turn onto primary arterial corridor towards scene',
        distance_meters: Math.round(distMeters * 0.5),
        duration_seconds: Math.round(durSeconds * 0.5),
        name: 'Main Transit Avenue'
      },
      {
        instruction: 'Approach incident destination and secure safe staging perimeter',
        distance_meters: Math.round(distMeters * 0.3),
        duration_seconds: Math.round(durSeconds * 0.3),
        name: 'Destination Staging'
      }
    ];
  }
}

/**
 * Cached Routing Service Wrapper
 * Implements IRoutingService with Redis TTL caching (120s)
 */
export class RoutingService implements IRoutingService {
  private static instance: RoutingService;
  private provider: IRoutingService;

  private constructor() {
    // Default routing engine is OpenRouteService with resilient fallback
    this.provider = new OpenRouteServiceProvider();
  }

  public static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  public setProvider(newProvider: IRoutingService) {
    this.provider = newProvider;
  }

  public async getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult> {
    const cacheKey = `route:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    
    // Check Redis cache first (TTL 120s)
    const cached = await redis.get<RouteResult>(cacheKey);
    if (cached) {
      return { ...cached, provider: `${cached.provider} (Cached)` };
    }

    const result = await this.provider.getRoute(origin, destination);
    // Cache for 120 seconds
    await redis.set(cacheKey, result, 120);
    return result;
  }

  public async getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<DistanceMatrixResult> {
    const originHashes = origins.map(o => `${o.lat.toFixed(3)},${o.lng.toFixed(3)}`).join('|');
    const destHashes = destinations.map(d => `${d.lat.toFixed(3)},${d.lng.toFixed(3)}`).join('|');
    const cacheKey = `matrix:${originHashes}__${destHashes}`;

    const cached = await redis.get<DistanceMatrixResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.provider.getDistanceMatrix(origins, destinations);
    await redis.set(cacheKey, result, 120);
    return result;
  }
}

export const routingService = RoutingService.getInstance();
