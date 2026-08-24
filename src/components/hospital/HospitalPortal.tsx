import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Bed, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  ShieldCheck, 
  MapPin, 
  Truck, 
  ChevronRight,
  Plus,
  Minus
} from 'lucide-react';
import { Hospital, DispatchJob, HospitalCapacityStatus } from '../../types/index.js';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { MapComponent } from '../MapComponent.js';

interface HospitalPortalProps {
  hospitals: Hospital[];
  currentHospitalId: string;
  onSelectHospital: (id: string) => void;
  onRefresh: () => void;
}

export const HospitalPortal: React.FC<HospitalPortalProps> = ({
  hospitals,
  currentHospitalId,
  onSelectHospital,
  onRefresh
}) => {
  const [queue, setQueue] = useState<DispatchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DispatchJob | null>(null);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [assignedBay, setAssignedBay] = useState('Resuscitation Bay 1');

  const selectedHospital = hospitals.find(h => h.id === currentHospitalId) || hospitals[0];

  const fetchQueue = async () => {
    if (!selectedHospital) return;
    try {
      setLoading(true);
      const res = await api.getHospitalIntakeQueue(selectedHospital.id);
      setQueue(res.queue);
      if (res.queue.length > 0 && !selectedJob) {
        setSelectedJob(res.queue[0]);
      }
    } catch (err) {
      console.error('Error fetching intake queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const socket = getSocket();

    const handleIncomingAlert = (data: { job: DispatchJob; hospital: Hospital }) => {
      if (data.hospital.id === selectedHospital?.id) {
        fetchQueue();
      }
    };

    const handleJobUpdated = () => {
      fetchQueue();
    };

    socket.on('hospital:incoming_alert', handleIncomingAlert);
    socket.on('hospital:job_updated', handleJobUpdated);
    socket.on('job:updated', handleJobUpdated);

    return () => {
      socket.off('hospital:incoming_alert', handleIncomingAlert);
      socket.off('hospital:job_updated', handleJobUpdated);
      socket.off('job:updated', handleJobUpdated);
    };
  }, [selectedHospital?.id]);

  const handleUpdateCapacity = async (newStatus: HospitalCapacityStatus) => {
    if (!selectedHospital) return;
    try {
      await api.updateHospitalCapacity(selectedHospital.id, newStatus, selectedHospital.available_beds);
      onRefresh();
    } catch (err: any) {
      alert('Error updating capacity: ' + err.message);
    }
  };

  const handleAdjustBeds = async (delta: number) => {
    if (!selectedHospital) return;
    const newBeds = Math.max(0, Math.min(selectedHospital.total_beds, selectedHospital.available_beds + delta));
    try {
      await api.updateHospitalCapacity(selectedHospital.id, selectedHospital.capacity_status, newBeds);
      onRefresh();
    } catch (err: any) {
      alert('Error updating beds: ' + err.message);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedHospital || !selectedJob) return;
    try {
      await api.acknowledgeIntake(selectedHospital.id, selectedJob.id, assignedBay);
      setBayModalOpen(false);
      fetchQueue();
      alert(`Patient acknowledged! ${assignedBay} prepared.`);
    } catch (err: any) {
      alert('Acknowledge failed: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col gap-5">
      {/* Hospital Intake Header & Capacity Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-950 text-purple-400 border border-purple-800/60 flex items-center justify-center shadow">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white">
                {selectedHospital?.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                {selectedHospital?.trauma_level}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {selectedHospital?.address}
            </p>
          </div>
        </div>

        {/* Hospital Facility Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Select Facility:</label>
          <select
            value={currentHospitalId}
            onChange={(e) => onSelectHospital(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.capacity_status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hospital Capacity & Specialty Management Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Capacity Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Intake Capacity Status</span>
          <div className="flex items-center gap-1.5 mt-3">
            {(['Normal', 'High', 'Diverted', 'Full'] as HospitalCapacityStatus[]).map(status => {
              const isActive = selectedHospital?.capacity_status === status;
              return (
                <button
                  key={status}
                  onClick={() => handleUpdateCapacity(status)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? status === 'Normal' ? 'bg-emerald-600 text-white shadow' :
                        status === 'High' ? 'bg-amber-600 text-white shadow' :
                        'bg-red-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Emergency Bed Counter */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Emergency Intake Beds</span>
            <div className="text-xl font-mono font-extrabold text-white mt-1">
              <span className="text-purple-400">{selectedHospital?.available_beds}</span>
              <span className="text-slate-500 text-sm font-normal"> / {selectedHospital?.total_beds} available</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdjustBeds(-1)}
              className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center transition cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAdjustBeds(1)}
              className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verified Specialties */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Specialty Receiving Badges</span>
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedHospital?.specialties.map(spec => (
              <span key={spec} className="px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 text-[10px] font-bold border border-purple-800/50">
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Inbound Queue & Live Approaching Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Inbound Patient Intake Queue */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              Inbound Ambulance Intake Queue ({queue.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">Live Sync</span>
          </div>

          {queue.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-white">No Inbound Ambulances</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                When a dispatcher assigns a patient to this facility, the live ETA and clinical handover details will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {queue.map(job => {
                const isSelected = selectedJob?.id === job.id;
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-5 rounded-3xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/30 border-purple-500 shadow-xl ring-1 ring-purple-500/50'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px]">
                            {job.call?.severity}
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-300">
                            Unit: {job.ambulance?.call_sign}
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-white mt-1.5">
                          {job.call?.chief_complaint}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          From: {job.call?.address}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400 font-mono block">
                          ETA ~{Math.round(job.eta_seconds / 60)} mins
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800 inline-block mt-1">
                          {job.status}
                        </span>
                      </div>
                    </div>

                    {job.call?.patient_notes && (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-200">
                        {job.call.patient_notes}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Paramedic: <strong>{job.ambulance?.driver?.name || 'On Duty Team'}</strong>
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(job);
                          setBayModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition cursor-pointer"
                      >
                        Acknowledge & Assign Bay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Incoming Approaching Map */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Live Approaching Radar
          </h3>
          <div className="h-[520px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <MapComponent
              ambulances={selectedJob?.ambulance ? [selectedJob.ambulance] : []}
              hospitals={selectedHospital ? [selectedHospital] : []}
              calls={selectedJob?.call ? [selectedJob.call] : []}
              activeJob={selectedJob}
              center={selectedHospital ? [selectedHospital.lat, selectedHospital.lng] : [37.7749, -122.4194]}
              zoom={14}
            />
          </div>
        </div>
      </div>

      {/* Bay Assignment Modal */}
      {bayModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white">Acknowledge Inbound Patient</h3>
            <p className="text-xs text-slate-400 mt-1">
              Confirm receiving readiness and assign emergency intake bay for unit <strong>{selectedJob.ambulance?.call_sign}</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Designated Emergency Bay:</label>
              <select
                value={assignedBay}
                onChange={(e) => setAssignedBay(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="Trauma Resuscitation Bay 01">Trauma Resuscitation Bay 01</option>
                <option value="Cardiac Cath Lab Prep Room">Cardiac Cath Lab Prep Room</option>
                <option value="Stroke Rapid Assessment Bay 02">Stroke Rapid Assessment Bay 02</option>
                <option value="Pediatric Critical Care Bay 04">Pediatric Critical Care Bay 04</option>
                <option value="General Acute Bed 08">General Acute Bed 08</option>
              </select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setBayModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                Confirm Intake Handover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
