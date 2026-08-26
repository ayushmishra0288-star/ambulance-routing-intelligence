import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Flame, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Truck, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Navigation, 
  Layers, 
  History, 
  Sparkles, 
  PhoneCall, 
  ArrowRight,
  Crosshair
} from 'lucide-react';
import { 
  EmergencyCall, 
  RankedAmbulance, 
  HospitalSuggestion, 
  DispatchJob, 
  StatusEvent, 
  Ambulance, 
  Hospital 
} from '../../types/index.js';
import { api } from '../../services/api.js';
import { MapComponent } from '../MapComponent.js';

interface DispatcherConsoleProps {
  calls: EmergencyCall[];
  ambulances: Ambulance[];
  hospitals: Hospital[];
  jobs: DispatchJob[];
  events: StatusEvent[];
  onRefresh: () => void;
  onOpenCallModal: () => void;
  isCallModalOpen?: boolean;
}

export const DispatcherConsole: React.FC<DispatcherConsoleProps> = ({
  calls,
  ambulances,
  hospitals,
  jobs,
  events,
  onRefresh,
  onOpenCallModal,
  isCallModalOpen = false
}) => {
  const [selectedCall, setSelectedCall] = useState<EmergencyCall | null>(null);
  const [rankedAmbulances, setRankedAmbulances] = useState<RankedAmbulance[]>([]);
  const [suggestedHospitals, setSuggestedHospitals] = useState<HospitalSuggestion[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'active_jobs' | 'audit_log'>('queue');
  const [selectedActiveJob, setSelectedActiveJob] = useState<DispatchJob | null>(null);

  // Auto select first pending call if none selected
  useEffect(() => {
    if (!selectedCall && calls.length > 0) {
      const pending = calls.find(c => c.status === 'Pending') || calls[0];
      setSelectedCall(pending);
    }
  }, [calls, selectedCall]);

  // Fetch ranked ambulances & suggested hospitals when selectedCall changes
  useEffect(() => {
    if (!selectedCall || selectedCall.status !== 'Pending') {
      setRankedAmbulances([]);
      setSuggestedHospitals([]);
      return;
    }

    let isMounted = true;
    setLoadingMatches(true);

    Promise.all([
      api.getRankedAmbulances(selectedCall.id),
      api.getSuggestedHospitals(selectedCall.id)
    ])
      .then(([ambRes, hospRes]) => {
        if (isMounted) {
          setRankedAmbulances(ambRes.ranked);
          setSuggestedHospitals(hospRes.suggestions);
          if (ambRes.ranked.length > 0) {
            setSelectedAmbulanceId(ambRes.ranked[0].ambulance.id);
          }
          if (hospRes.suggestions.length > 0) {
            setSelectedHospitalId(hospRes.suggestions[0].hospital.id);
          }
        }
      })
      .catch(err => {
        console.error('Error fetching matches:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingMatches(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCall?.id, selectedCall?.status]);

  const handleDispatch = async () => {
    if (!selectedCall || !selectedAmbulanceId || !selectedHospitalId) return;

    setDispatching(true);
    try {
      await api.assignJob(selectedCall.id, selectedAmbulanceId, selectedHospitalId);
      onRefresh();
      // Select next pending call if available
      const nextPending = calls.find(c => c.id !== selectedCall.id && c.status === 'Pending');
      setSelectedCall(nextPending || null);
    } catch (err: any) {
      alert('Dispatch failed: ' + err.message);
    } finally {
      setDispatching(false);
    }
  };

  const pendingCalls = calls.filter(c => c.status === 'Pending');
  const activeMissions = jobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled');
  const selectedAmbulanceMatch = rankedAmbulances.find(
    match => match.ambulance.id === selectedAmbulanceId
  );
  const selectedHospitalSuggestion = suggestedHospitals.find(
    suggestion => suggestion.hospital.id === selectedHospitalId
  );
  const combinedTravelMinutes =
    selectedAmbulanceMatch && selectedHospitalSuggestion
      ? Math.ceil(
          (selectedAmbulanceMatch.eta_seconds + selectedHospitalSuggestion.eta_seconds) / 60
        )
      : null;

  return (
    <div className="mx-auto grid min-h-[700px] max-w-[1600px] grid-cols-1 gap-5 p-4 lg:grid-cols-12 xl:h-[calc(100vh-12rem)]">
      {/* Left Column: Intake Queue & Intelligent Match Panel */}
      <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden h-full">
        {/* Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-xl flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Intake Queue ({pendingCalls.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('active_jobs')}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'active_jobs'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Active Missions ({activeMissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_log')}
            className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'audit_log'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Tab 1: Intake Queue & AI Match */}
        {activeTab === 'queue' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Pending Calls List Header */}
            {pendingCalls.length === 0 ? (
              <div className="flex-1 rounded-2xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">All Emergency Queues Clear</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  No unassigned 101 calls. Create a new emergency call to trigger the spatial pre-filter and ETA ranker.
                </p>
                <button
                  onClick={onOpenCallModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  Create Demo 101 Call
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                {/* Emergency Call Selection Chips */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingCalls.map(c => {
                    const isSelected = selectedCall?.id === c.id;
                    const isHighSev = c.severity.includes('Level 1') || c.severity.includes('Level 2');
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCall(c)}
                        className={`px-3 py-2 rounded-xl border text-left flex-shrink-0 transition cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800 border-red-500 shadow-md shadow-red-500/10 ring-1 ring-red-500/50'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isHighSev ? 'bg-red-500 animate-ping' : 'bg-amber-400'}`} />
                          <span className="text-xs font-bold text-white">#{c.id.split('-')[1]}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 font-mono">
                            {c.severity.split(' - ')[0]}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium truncate max-w-[140px] mt-1">
                          {c.chief_complaint}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Call Detail Banner */}
                {selectedCall && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                            {selectedCall.severity}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(selectedCall.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1.5">{selectedCall.chief_complaint}</h3>
                        <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {selectedCall.address}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block font-mono">Caller: {selectedCall.caller_info}</span>
                        <span className="text-[11px] text-slate-400 block font-mono">{selectedCall.caller_phone}</span>
                      </div>
                    </div>
                    {selectedCall.patient_notes && (
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-950 text-[11px] text-amber-200/90 border border-amber-900/30">
                        {selectedCall.patient_notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Intelligent Match Recommendations */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Geospatial Pre-Filter & ETA Ranking
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                        PostGIS: 30km
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Road-network ETA
                      </span>
                    </div>
                  </div>

                  {loadingMatches ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs text-slate-400">Computing real-time road ETA & equipment matching matrix...</p>
                    </div>
                  ) : rankedAmbulances.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No Available units found within pre-filter radius.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {rankedAmbulances.map((match, idx) => {
                        const amb = match.ambulance;
                        const isSelected = selectedAmbulanceId === amb.id;
                        return (
                          <div
                            key={amb.id}
                            onClick={() => setSelectedAmbulanceId(amb.id)}
                            className={`p-3 rounded-xl border transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                                }`}>
                                  #{idx + 1}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    {amb.call_sign}
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                      {amb.equipment_level}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Driver: {amb.driver ? amb.driver.name : 'EMT Team'} • {match.distance_km} km away
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xs font-mono font-bold text-emerald-400">
                                  ETA {match.eta_formatted}
                                </div>
                                <div className="text-[10px] font-bold text-blue-400">
                                  {match.match_score}% Match Score
                                </div>
                              </div>
                            </div>

                            {/* Score detail bar */}
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>Prox: {match.score_breakdown.proximity_score}pt</span>
                              <span>Equip: {match.score_breakdown.equipment_score}pt</span>
                              <span className={match.equipment_match ? 'text-emerald-400' : 'text-amber-400'}>
                                {match.equipment_match ? 'Optimal Level Match' : 'Basic Tier Unit'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Destination Hospital Selection */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
                        Target Destination Hospital:
                      </span>
                      <span className="text-[10px] text-slate-400">Specialty & Capacity Filter</span>
                    </label>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {suggestedHospitals.map(s => {
                        const isSelected = selectedHospitalId === s.hospital.id;
                        return (
                          <div
                            key={s.hospital.id}
                            onClick={() => setSelectedHospitalId(s.hospital.id)}
                            className={`p-2 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-purple-950/40 border-purple-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex-1 mr-2">
                              <div className="font-semibold flex items-center gap-1.5">
                                <span className="truncate">{s.hospital.name}</span>
                                {s.is_recommended && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[9px] border border-emerald-800 font-bold">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{s.hospital.available_beds} beds free</span>
                                <span>•</span>
                                <span>{s.match_reasons[0] || s.hospital.trauma_level}</span>
                              </div>
                            </div>
                            <div className="text-right font-mono font-bold text-xs text-purple-300">
                              {s.eta_formatted}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explainable dispatch decision */}
                  {selectedAmbulanceMatch && selectedHospitalSuggestion && (
                    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/70 via-slate-950 to-violet-950/60 p-3">
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
                      <div className="relative">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            Explainable dispatch brief
                          </span>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-200">
                            Human confirmed
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                          <strong className="text-white">{selectedAmbulanceMatch.ambulance.call_sign}</strong>
                          {' '}can reach the scene in{' '}
                          <strong className="text-emerald-300">{selectedAmbulanceMatch.eta_formatted}</strong>.
                          {' '}The selected destination,{' '}
                          <strong className="text-violet-300">{selectedHospitalSuggestion.hospital.name}</strong>,
                          {' '}has {selectedHospitalSuggestion.hospital.available_beds} intake beds and a scene-to-hospital ETA of{' '}
                          {selectedHospitalSuggestion.eta_formatted}.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[9px] font-bold text-blue-200">
                            {selectedAmbulanceMatch.match_score}% response fit
                          </span>
                          <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-200">
                            {selectedAmbulanceMatch.equipment_match ? 'Capability matched' : 'Capability exception'}
                          </span>
                          <span className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[9px] font-bold text-violet-200">
                            ~{combinedTravelMinutes} min combined travel
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirm & Dispatch Action */}
                  <button
                    onClick={handleDispatch}
                    disabled={dispatching || !selectedAmbulanceId || !selectedHospitalId || rankedAmbulances.length === 0}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>
                      {dispatching ? 'Assigning Unit & Computing Route...' : 'Confirm Ambulance Assignment & Push Route'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Active Missions */}
        {activeTab === 'active_jobs' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeMissions.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center text-xs text-slate-400">
                No active ambulance missions in transit.
              </div>
            ) : (
              activeMissions.map(job => {
                const isSelected = selectedActiveJob?.id === job.id;
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedActiveJob(job)}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500 ring-1 ring-blue-500/40 shadow-lg'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center font-bold text-xs">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {job.ambulance?.call_sign || 'Ambulance'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Incident #{job.call_id.split('-')[1]} • Assigned at {new Date(job.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        job.status === 'En Route' ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse' :
                        job.status === 'On Scene' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        job.status === 'Transporting' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        'bg-purple-950 text-purple-400 border border-purple-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Complaint:</span>
                        <span className="text-slate-200 font-medium truncate block">{job.call?.chief_complaint}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Hospital Destination:</span>
                        <span className="text-purple-300 font-medium truncate block">{job.hospital?.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Audit Trail Events */}
        {activeTab === 'audit_log' && (
          <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-300">Mandatory Status Events Log</span>
              <span className="text-[10px] text-slate-500">Immutable Ledger</span>
            </div>
            {events.length === 0 ? (
              <p className="text-slate-500 text-center py-6">No status audit events recorded yet.</p>
            ) : (
              events.map(e => (
                <div key={e.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="font-bold text-blue-400">EVENT: {e.event_type}</span>
                    <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300 mt-1">{e.notes || 'Status progression event'}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Job ID: {e.job_id} {e.lat ? `• GPS: ${e.lat.toFixed(4)}, ${e.lng?.toFixed(4)}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Column: Live Map */}
      <div 
        className={`lg:col-span-7 h-full flex flex-col gap-2 ${isCallModalOpen ? 'hidden' : ''}`}
        style={{ display: isCallModalOpen ? 'none' : 'flex' }}
      >
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white">City operations map</h2>
            <p className="text-[10px] text-slate-500">Fleet telemetry, hospital readiness, incidents, and live traffic</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Decision layer online
          </div>
        </div>
        <div className="flex-1 min-h-[420px] rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20 border border-cyan-400/10">
          <MapComponent
            ambulances={ambulances}
            hospitals={hospitals}
            calls={calls}
            activeJob={selectedActiveJob || jobs.find(j => j.call_id === selectedCall?.id) || null}
            selectedCall={selectedCall}
          />
        </div>
      </div>
    </div>
  );
};
