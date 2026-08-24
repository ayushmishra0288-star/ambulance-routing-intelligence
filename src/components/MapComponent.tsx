/**
 * Interactive Leaflet Map Component with Live Telemetry,
 * Turn-by-Turn Path Visualizer, Hospital Pins, and Incident Markers.
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Ambulance, Hospital, EmergencyCall, DispatchJob } from '../types/index.js';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const mapCenter: L.LatLngTuple = [center[0], center[1]];
      const map = L.map(mapContainerRef.current, {
        center: mapCenter,
        zoom,
        zoomControl: false,
        attributionControl: false
      });

      // Dark theme map tiles (CartoDB Dark Matter / OpenStreetMap)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onMapClick) {
          onMapClick({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) });
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Center if changed
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      const mapCenter: L.LatLngTuple = [center[0], center[1]];
      mapInstanceRef.current.setView(mapCenter, zoom);
    }
  }, [center?.[0], center?.[1], zoom]);

  // Render Markers and Active Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. Render Hospitals
    hospitals.forEach(hosp => {
      const statusColor = 
        hosp.capacity_status === 'Normal' ? '#10b981' :
        hosp.capacity_status === 'High' ? '#f59e0b' : '#ef4444';

      const hospIcon = L.divIcon({
        className: 'custom-hosp-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border-2" style="background-color: #0f172a; border-color: ${statusColor};">
              <svg class="w-5 h-5" style="color: ${statusColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 6v12m-6-6h12" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white border border-slate-700 shadow">
              ${hosp.available_beds}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([hosp.lat, hosp.lng], { icon: hospIcon });
      marker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans max-w-xs">
          <div class="flex items-center gap-1.5 font-bold text-sm text-slate-900">
            <span class="w-2.5 h-2.5 rounded-full" style="background: ${statusColor};"></span>
            ${hosp.name}
          </div>
          <div class="text-xs text-slate-600 mt-1">${hosp.address}</div>
          <div class="mt-2 flex items-center justify-between text-xs font-semibold">
            <span>Trauma: ${hosp.trauma_level}</span>
            <span class="px-2 py-0.5 rounded text-white" style="background: ${statusColor};">${hosp.capacity_status}</span>
          </div>
          <div class="mt-1 text-xs text-slate-700">
            <strong>${hosp.available_beds}</strong> of ${hosp.total_beds} intake beds ready
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            ${hosp.specialties.slice(0, 3).map(s => `<span class="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">${s}</span>`).join('')}
          </div>
        </div>
      `);
      markersGroup.addLayer(marker);
    });

    // 2. Render Ambulances
    ambulances.forEach(amb => {
      const isFocused = focusAmbulanceId === amb.id;
      const isAvailable = amb.status === 'Available';
      const isEnRoute = amb.status === 'En Route' || amb.status === 'Transporting';
      const statusBg = isAvailable ? '#059669' : isEnRoute ? '#dc2626' : '#64748b';

      const ambIcon = L.divIcon({
        className: 'custom-amb-marker',
        html: `
          <div class="relative flex flex-col items-center cursor-pointer ${isFocused ? 'scale-125 z-50' : ''}">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white transition-transform duration-300" 
                 style="background-color: ${statusBg}; transform: rotate(${amb.heading_deg || 0}deg);">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2" stroke-linecap="round"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
            </div>
            <div class="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-[10px] font-mono font-bold text-white border border-slate-700 whitespace-nowrap shadow">
              ${amb.call_sign.split(' ')[0]}
            </div>
          </div>
        `,
        iconSize: [36, 46],
        iconAnchor: [18, 23]
      });

      const marker = L.marker([amb.current_lat, amb.current_lng], { icon: ambIcon });
      marker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans">
          <div class="font-bold text-sm text-slate-950">${amb.call_sign}</div>
          <div class="text-xs text-slate-600">Plate: ${amb.plate}</div>
          <div class="mt-1 flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background: ${statusBg};">${amb.status}</span>
            <span class="text-[11px] text-slate-700 font-medium">${amb.equipment_level} Unit</span>
          </div>
          ${amb.driver ? `<div class="mt-1 text-xs text-slate-600">Driver: <strong>${amb.driver.name}</strong></div>` : ''}
          ${amb.speed_kmh ? `<div class="mt-0.5 text-xs text-slate-600">Speed: ${amb.speed_kmh} km/h</div>` : ''}
        </div>
      `);
      markersGroup.addLayer(marker);
    });

    // 3. Render Emergency Calls
    calls.forEach(c => {
      const isSelected = selectedCall?.id === c.id;
      const isPending = c.status === 'Pending';
      const isHighSev = c.severity.includes('Level 1') || c.severity.includes('Level 2');
      const pulseColor = isHighSev ? '#ef4444' : '#f97316';

      const callIcon = L.divIcon({
        className: 'custom-call-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            ${isPending ? `<div class="absolute w-8 h-8 rounded-full animate-ping opacity-75" style="background-color: ${pulseColor};"></div>` : ''}
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl border-2 ${isSelected ? 'border-amber-300 scale-125' : 'border-white'}" 
                 style="background-color: ${pulseColor};">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([c.lat, c.lng], { icon: callIcon });
      marker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans max-w-xs">
          <div class="flex items-center gap-1 text-xs font-bold text-red-600 uppercase">
            ${c.severity}
          </div>
          <div class="font-bold text-sm text-slate-950 mt-0.5">${c.chief_complaint}</div>
          <div class="text-xs text-slate-600 mt-1">${c.address}</div>
          <div class="text-xs text-slate-600 mt-0.5">Caller: ${c.caller_info} (${c.caller_phone})</div>
          <div class="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
            Status: ${c.status}
          </div>
        </div>
      `);
      markersGroup.addLayer(marker);
    });

    // 4. Render Active Job Route Polyline
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (activeJob && activeJob.coordinates && activeJob.coordinates.length > 0) {
      const polyline = L.polyline(activeJob.coordinates, {
        color: '#3b82f6',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: activeJob.status === 'Assigned' ? '8, 8' : undefined
      }).addTo(map);

      routeLayerRef.current = polyline;

      // Fit map bounds to show full route
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    }
  }, [ambulances, hospitals, calls, activeJob, selectedCall, focusAmbulanceId]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-slate-800 shadow-inner bg-slate-900">
      <div ref={mapContainerRef} className={className} />

      {interactivePick && (
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-amber-300 font-medium flex items-center gap-2 shadow-lg">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          Click anywhere on the map to set Incident coordinates
        </div>
      )}
    </div>
  );
};
