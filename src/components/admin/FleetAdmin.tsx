import React, { useState } from 'react';
import { 
  Layers, 
  Truck, 
  User, 
  Building2, 
  ShieldCheck, 
  Activity, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Ambulance, Driver, Hospital, AmbulanceStatus } from '../../types/index.js';
import { api } from '../../services/api.js';

interface FleetAdminProps {
  ambulances: Ambulance[];
  drivers: Driver[];
  hospitals: Hospital[];
  onRefresh: () => void;
}

export const FleetAdmin: React.FC<FleetAdminProps> = ({
  ambulances,
  drivers,
  hospitals,
  onRefresh
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (ambId: string, newStatus: AmbulanceStatus) => {
    setUpdatingId(ambId);
    try {
      await api.updateAmbulanceStatus(ambId, newStatus);
      onRefresh();
    } catch (err: any) {
      alert('Error updating ambulance status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>Fleet & Hospital Registry Operations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Admin console for managing vehicle states, driver certifications, and facility configurations.
          </p>
        </div>
      </div>

      {/* Ambulance Inventory */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            Ambulance Fleet Inventory ({ambulances.length} Units)
          </h3>
          <span className="text-xs text-slate-400 font-mono">PostGIS Indexed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {ambulances.map(amb => (
            <div key={amb.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{amb.call_sign}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    amb.status === 'Available' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    amb.status === 'Maintenance' ? 'bg-slate-800 text-slate-400' :
                    'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {amb.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Plate: {amb.plate} • {amb.equipment_level} Rig
                </div>
                <div className="text-xs text-slate-300 mt-2">
                  Assigned EMT: <strong>{amb.driver?.name || 'Unassigned'}</strong>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  GPS: {amb.current_lat.toFixed(4)}, {amb.current_lng.toFixed(4)}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Override Status:</span>
                <select
                  value={amb.status}
                  disabled={updatingId === amb.id}
                  onChange={(e) => handleStatusChange(amb.id, e.target.value as AmbulanceStatus)}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-bold focus:outline-none"
                >
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Assigned">Assigned</option>
                  <option value="En Route">En Route</option>
                  <option value="On Scene">On Scene</option>
                  <option value="Transporting">Transporting</option>
                  <option value="At Hospital">At Hospital</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Roster & Hospital Facilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drivers */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-4 border-b border-slate-800">
            <User className="w-4 h-4 text-blue-400" />
            Paramedic & EMT Roster ({drivers.length})
          </h3>
          <div className="space-y-3 mt-4 max-h-72 overflow-y-auto pr-1">
            {drivers.map(drv => (
              <div key={drv.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{drv.name}</div>
                  <div className="text-slate-400 text-[11px] font-mono mt-0.5">Phone: {drv.phone}</div>
                </div>
                <div className="text-right font-mono">
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                    {drv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hospital Directory */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-4 border-b border-slate-800">
            <Building2 className="w-4 h-4 text-purple-400" />
            Regional Trauma & Intake Facilities ({hospitals.length})
          </h3>
          <div className="space-y-3 mt-4 max-h-72 overflow-y-auto pr-1">
            {hospitals.map(h => (
              <div key={h.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white">{h.name}</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    h.capacity_status === 'Normal' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    h.capacity_status === 'High' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {h.capacity_status} ({h.available_beds}/{h.total_beds} beds)
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-1">{h.address}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {h.specialties.map(s => (
                    <span key={s} className="px-1.5 py-0.2 bg-slate-900 text-slate-300 rounded text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
