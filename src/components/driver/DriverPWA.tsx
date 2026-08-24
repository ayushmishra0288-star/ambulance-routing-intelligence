import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  Truck, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  Play, 
  Pause, 
  Radio, 
  Compass, 
  ArrowUpRight, 
  ShieldAlert, 
  Volume2, 
  RotateCcw,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Ambulance, DispatchJob, JobStatus, RouteStep } from '../../types/index.js';
import { api } from '../../services/api.js';
import { sendDriverLocation, sendDriverStatusUpdate, getSocket } from '../../services/socket.js';
import { MapComponent } from '../MapComponent.js';

interface DriverPWAProps {
  ambulances: Ambulance[];
  currentAmbulanceId: string;
  onSelectAmbulance: (id: string) => void;
  onRefresh: () => void;
  isCallModalOpen?: boolean;
}

export const DriverPWA: React.FC<DriverPWAProps> = ({
  ambulances,
  currentAmbulanceId,
  onSelectAmbulance,
  onRefresh,
  isCallModalOpen = false
}) => {
  const [activeJob, setActiveJob] = useState<DispatchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeCoordIndex, setRouteCoordIndex] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(48);
  const [browserGpsActive, setBrowserGpsActive] = useState(false);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const selectedAmbulance = ambulances.find(a => a.id === currentAmbulanceId) || ambulances[0];

  // Fetch active job for this ambulance
  const fetchJob = async () => {
    if (!selectedAmbulance) return;
    try {
      const res = await api.getActiveJobForAmbulance(selectedAmbulance.id);
      setActiveJob(res.activeJob);
    } catch (err) {
      console.error('Error fetching driver active job:', err);
    }
  };

  useEffect(() => {
    fetchJob();
    const socket = getSocket();

    const handleJobAssigned = (job: DispatchJob) => {
      if (job.ambulance_id === selectedAmbulance?.id) {
        setActiveJob(job);
        setRouteCoordIndex(0);
      }
    };

    const handleJobUpdated = (data: { job: DispatchJob }) => {
      if (data.job.ambulance_id === selectedAmbulance?.id) {
        setActiveJob(data.job);
        if (data.job.status === 'Completed' || data.job.status === 'Cancelled') {
          setActiveJob(null);
          setIsSimulating(false);
        }
      }
    };

    socket.on('job:assigned', handleJobAssigned);
    socket.on('job:updated', handleJobUpdated);

    return () => {
      socket.off('job:assigned', handleJobAssigned);
      socket.off('job:updated', handleJobUpdated);
    };
  }, [selectedAmbulance?.id]);

  // Handle Simulation Loop
  useEffect(() => {
    if (isSimulating && activeJob && activeJob.coordinates && activeJob.coordinates.length > 0) {
      simTimerRef.current = setInterval(() => {
        setRouteCoordIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= activeJob.coordinates!.length) {
            // Reached destination for current leg
            setIsSimulating(false);
            return prev;
          }

          const currentPoint = activeJob.coordinates![nextIndex];
          const prevPoint = activeJob.coordinates![prev];
          
          // Calculate heading angle
          const dLng = currentPoint[1] - prevPoint[1];
          const dLat = currentPoint[0] - prevPoint[0];
          const heading = (Math.atan2(dLng, dLat) * (180 / Math.PI) + 360) % 360;

          // Stream live location to server and socket
          sendDriverLocation({
            ambulanceId: selectedAmbulance.id,
            lat: currentPoint[0],
            lng: currentPoint[1],
            speed: Math.floor(40 + Math.random() * 18),
            heading: Math.round(heading),
            jobId: activeJob.id
          });

          return nextIndex;
        });
      }, 1500);
    } else {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    }

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [isSimulating, activeJob?.id, activeJob?.coordinates?.length, selectedAmbulance?.id]);

  // Real browser geolocation toggle
  const toggleBrowserGps = () => {
    if (browserGpsActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setBrowserGpsActive(false);
    } else {
      if ('geolocation' in navigator) {
        setBrowserGpsActive(true);
        watchIdRef.current = navigator.geolocation.watchPosition(
          pos => {
            const { latitude, longitude, speed, heading } = pos.coords;
            sendDriverLocation({
              ambulanceId: selectedAmbulance.id,
              lat: latitude,
              lng: longitude,
              speed: speed ? Math.round(speed * 3.6) : 0,
              heading: heading ? Math.round(heading) : 0,
              jobId: activeJob?.id
            });
          },
          err => {
            console.warn('Geolocation watch error:', err.message);
            setBrowserGpsActive(false);
          },
          { enableHighAccuracy: true }
        );
      }
    }
  };

  // Status Progression Action
  const handleProgressStatus = async () => {
    if (!activeJob) return;

    let nextStatus: JobStatus | null = null;
    if (activeJob.status === 'Assigned') nextStatus = 'En Route';
    else if (activeJob.status === 'En Route') nextStatus = 'On Scene';
    else if (activeJob.status === 'On Scene') nextStatus = 'Transporting';
    else if (activeJob.status === 'Transporting') nextStatus = 'At Hospital';
    else if (activeJob.status === 'At Hospital') nextStatus = 'Completed';

    if (!nextStatus) return;

    try {
      const res = await api.updateJobStatus(
        activeJob.id,
        nextStatus,
        `Status updated by driver on unit ${selectedAmbulance.call_sign}`,
        selectedAmbulance.current_lat,
        selectedAmbulance.current_lng
      );
      setActiveJob(res.job.status === 'Completed' ? null : res.job);
      setRouteCoordIndex(0);
      onRefresh();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const getStatusButtonText = () => {
    if (!activeJob) return 'Standing By';
    if (activeJob.status === 'Assigned') return '1. Acknowledge & Go En Route to Scene';
    if (activeJob.status === 'En Route') return '2. Confirm Arrived On Scene';
    if (activeJob.status === 'On Scene') return '3. Patient Loaded — Transport to Hospital';
    if (activeJob.status === 'Transporting') return '4. Confirm Arrived At Hospital';
    if (activeJob.status === 'At Hospital') return '5. Handover Complete — Unit Available';
    return 'Status Updated';
  };

  const steps: RouteStep[] = activeJob?.turn_by_turn_steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-4">
      {/* Unit Selector & Driver Status Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center justify-center font-bold text-base shadow">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                {selectedAmbulance?.call_sign || 'Ambulance Terminal'}
              </h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedAmbulance?.status === 'Available' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                'bg-red-950 text-red-400 border border-red-800 animate-pulse'
              }`}>
                {selectedAmbulance?.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Plate: {selectedAmbulance?.plate} • {selectedAmbulance?.equipment_level} Rig • Driver: {selectedAmbulance?.driver?.name || 'Assigned Paramedic'}
            </p>
          </div>
        </div>

        {/* Switch Ambulance rig */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Switch Rig:</label>
          <select
            value={currentAmbulanceId}
            onChange={(e) => onSelectAmbulance(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {ambulances.map(a => (
              <option key={a.id} value={a.id}>
                {a.call_sign} ({a.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Driver Terminal Display */}
      {!activeJob ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center mb-4">
            <Radio className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-white">Standing By for Dispatch</h3>
          <p className="text-xs text-slate-400 max-w-md mt-2">
            Unit is currently marked <strong className="text-emerald-400">Available</strong> in the city fleet registry. Telemetry is streaming staging coordinates.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={toggleBrowserGps}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                browserGpsActive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{browserGpsActive ? 'Browser GPS Streaming (Active)' : 'Enable Browser GPS Stream'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Job Alert Card */}
          <div className="bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border border-red-800/60 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-xs">
                    EMERGENCY DISPATCH
                  </span>
                  <span className="text-xs text-red-300 font-mono font-bold">
                    {activeJob.call?.severity}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white mt-2">
                  {activeJob.call?.chief_complaint}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                  <MapPin className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="font-semibold">{activeJob.call?.address}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-mono">Target Hospital:</span>
                <span className="text-xs font-bold text-purple-300 block max-w-[160px] truncate">
                  {activeJob.hospital?.name}
                </span>
              </div>
            </div>

            {/* Turn-by-Turn HUD Banner */}
            {currentStep && (
              <div className="mt-4 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-400 font-mono font-bold uppercase block">Next Maneuver</span>
                    <span className="text-xs font-bold text-white block">{currentStep.instruction}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-300">{currentStep.distance_meters}m</span>
                </div>
              </div>
            )}

            {/* Large Job Status Progression Button */}
            <div className="mt-4">
              <button
                onClick={handleProgressStatus}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm tracking-wide shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{getStatusButtonText()}</span>
              </button>
            </div>

            {/* Simulation & GPS Stream Controls */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSimulating
                      ? 'bg-amber-600 text-white shadow'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimulating ? 'Pause Drive Sim' : 'Auto-Drive Cruise Sim'}</span>
                </button>

                <button
                  onClick={toggleBrowserGps}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    browserGpsActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{browserGpsActive ? 'Live GPS (Active)' : 'Real Device GPS'}</span>
                </button>
              </div>

              <div className="font-mono text-slate-400 text-[11px] flex items-center gap-2">
                <span>Waypoint: {routeCoordIndex}/{activeJob.coordinates?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Navigation Map for Driver */}
          <div 
            className={`h-[360px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 ${isCallModalOpen ? 'hidden' : ''}`}
            style={{ display: isCallModalOpen ? 'none' : 'block' }}
          >
            <MapComponent
              ambulances={[selectedAmbulance]}
              hospitals={activeJob.hospital ? [activeJob.hospital] : []}
              calls={activeJob.call ? [activeJob.call] : []}
              activeJob={activeJob}
              center={[selectedAmbulance.current_lat, selectedAmbulance.current_lng]}
              zoom={15}
              focusAmbulanceId={selectedAmbulance.id}
            />
          </div>
        </div>
      )}
    </div>
  );
};
