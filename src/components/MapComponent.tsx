import React, { useEffect, useRef, useState } from 'react';
import { Ambulance, Hospital, EmergencyCall, DispatchJob } from '../types/index.js';

declare global {
  interface Window {
    google?: any;
    __airGoogleMapsPromise?: Promise<any>;
  }
}

interface MapComponentProps {
  ambulances?: Ambulance[];
  hospitals?: Hospital[];
  calls?: EmergencyCall[];
  activeJob?: DispatchJob | null;
  selectedCall?: EmergencyCall | null;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  center?: [number, number];
  zoom?: number;
  interactivePick?: boolean;
  className?: string;
  focusAmbulanceId?: string;
}

const GOOGLE_MAPS_SCRIPT_ID = 'air-google-maps-script';

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__airGoogleMapsPromise) return window.__airGoogleMapsPromise;

  window.__airGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps failed to load. Check the API key and its HTTP referrer restrictions.'));
    document.head.appendChild(script);
  });

  return window.__airGoogleMapsPromise;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const MapComponent: React.FC<MapComponentProps> = ({
  ambulances = [],
  hospitals = [],
  calls = [],
  activeJob = null,
  selectedCall = null,
  onMapClick,
  center = [37.7749, -122.4194],
  zoom = 13,
  interactivePick = false,
  className = 'h-full w-full min-h-[450px]',
  focusAmbulanceId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    if (!apiKey) {
      setLoadError('Google Maps API key is missing. Add VITE_GOOGLE_MAPS_API_KEY to your environment.');
      return;
    }

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#172033' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#172033' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#a8b3c7' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] }
          ]
        });
        infoWindowRef.current = new maps.InfoWindow();
        setMapsReady(true);
      })
      .catch((error) => !cancelled && setLoadError(error.message));

    return () => {
      cancelled = true;
      if (clickListenerRef.current) clickListenerRef.current.remove();
      markersRef.current.forEach(marker => marker.setMap(null));
      routeRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: center[0], lng: center[1] });
      mapRef.current.setZoom(zoom);
    }
  }, [center[0], center[1], zoom, mapsReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !mapsReady) return;

    clickListenerRef.current?.remove();
    clickListenerRef.current = map.addListener('click', (event: any) => {
      if (!onMapClick || !event.latLng) return;
      onMapClick({
        lat: Number(event.latLng.lat().toFixed(5)),
        lng: Number(event.latLng.lng().toFixed(5))
      });
    });

    return () => clickListenerRef.current?.remove();
  }, [onMapClick, mapsReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps || !mapsReady) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const addMarker = (position: { lat: number; lng: number }, title: string, label: string, color: string, html: string, focused = false) => {
      const marker = new maps.Marker({
        map,
        position,
        title,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: focused ? 4 : 2,
          scale: focused ? 13 : 10
        },
        label: { text: label, color: '#ffffff', fontWeight: '700', fontSize: '10px' },
        zIndex: focused ? 1000 : undefined
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(html);
        infoWindowRef.current.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
    };

    hospitals.forEach(hospital => {
      const color = hospital.capacity_status === 'Normal' ? '#10b981' : hospital.capacity_status === 'High' ? '#f59e0b' : '#ef4444';
      addMarker(
        { lat: hospital.lat, lng: hospital.lng }, hospital.name, 'H', color,
        `<div style="max-width:260px;font:13px system-ui;color:#0f172a"><strong>${escapeHtml(hospital.name)}</strong><br>${escapeHtml(hospital.address)}<br><b>${hospital.available_beds}</b> beds available · ${escapeHtml(hospital.capacity_status)}<br>Trauma: ${escapeHtml(hospital.trauma_level)}</div>`
      );
    });

    ambulances.forEach(ambulance => {
      const color = ambulance.status === 'Available' ? '#059669' : ['En Route', 'Transporting'].includes(ambulance.status) ? '#dc2626' : '#64748b';
      const focused = ambulance.id === focusAmbulanceId;
      addMarker(
        { lat: ambulance.current_lat, lng: ambulance.current_lng }, ambulance.call_sign, 'A', color,
        `<div style="font:13px system-ui;color:#0f172a"><strong>${escapeHtml(ambulance.call_sign)}</strong><br>${escapeHtml(ambulance.plate)} · ${escapeHtml(ambulance.status)}<br>${escapeHtml(ambulance.equipment_level)} unit${ambulance.driver ? `<br>Driver: ${escapeHtml(ambulance.driver.name)}` : ''}</div>`,
        focused
      );
    });

    calls.forEach(call => {
      const highSeverity = call.severity.includes('Level 1') || call.severity.includes('Level 2');
      addMarker(
        { lat: call.lat, lng: call.lng }, call.chief_complaint, '!', highSeverity ? '#ef4444' : '#f97316',
        `<div style="max-width:260px;font:13px system-ui;color:#0f172a"><strong>${escapeHtml(call.severity)}</strong><br>${escapeHtml(call.chief_complaint)}<br>${escapeHtml(call.address)}<br>Status: ${escapeHtml(call.status)}</div>`,
        selectedCall?.id === call.id
      );
    });

    routeRef.current?.setMap(null);
    routeRef.current = null;
    if (activeJob?.coordinates?.length) {
      routeRef.current = new maps.Polyline({
        map,
        path: activeJob.coordinates.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#3b82f6',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        geodesic: true
      });
      const bounds = new maps.LatLngBounds();
      activeJob.coordinates.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      map.fitBounds(bounds, 48);
    }
  }, [ambulances, hospitals, calls, activeJob, selectedCall, focusAmbulanceId, mapsReady]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-slate-800 shadow-inner bg-slate-900">
      <div ref={containerRef} className={className} />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center">
          <div>
            <p className="font-bold text-red-400">Google Maps could not start</p>
            <p className="mt-2 max-w-md text-xs text-slate-400">{loadError}</p>
          </div>
        </div>
      )}
      {!mapsReady && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm text-slate-400">Loading Google Maps…</div>
      )}
      {interactivePick && mapsReady && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-amber-300 font-medium shadow-lg">
          Click anywhere on the map to set incident coordinates
        </div>
      )}
    </div>
  );
};
