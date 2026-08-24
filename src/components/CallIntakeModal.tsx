import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  MapPin, 
  User, 
  Phone, 
  FileText, 
  Flame, 
  Zap, 
  Compass 
} from 'lucide-react';
import { CallSeverity } from '../types/index.js';

interface CallIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (callData: {
    caller_info: string;
    caller_phone: string;
    chief_complaint: string;
    lat: number;
    lng: number;
    address: string;
    severity: CallSeverity;
    patient_notes?: string;
  }) => Promise<void>;
}

const PRESET_SCENARIOS = [
  {
    title: 'STEMI / Acute Cardiac Alert',
    severity: 'Level 1 - Resuscitation' as CallSeverity,
    complaint: 'Crushing Substernal Chest Pain with Diaphoresis',
    address: 'Market St & 4th St, San Francisco, CA 94103',
    lat: 37.7879,
    lng: -122.4075,
    notes: '58yo male conscious, radiating left arm pain, pale/clammy. Requires Cath Lab facility.'
  },
  {
    title: 'Major Traffic Collision (Trauma)',
    severity: 'Level 1 - Resuscitation' as CallSeverity,
    complaint: 'High-speed Vehicle vs Motorcycle Collision',
    address: '16th St & Potrero Ave, San Francisco, CA 94103',
    lat: 37.7662,
    lng: -122.4071,
    notes: 'Rider ejected approx 15ft, altered mental status, suspected pelvic and extremity fracture.'
  },
  {
    title: 'Acute Stroke Symptoms (FAST+)',
    severity: 'Level 2 - Emergent' as CallSeverity,
    complaint: 'Sudden Right-sided Weakness and Slurred Speech',
    address: '2200 Post St, San Francisco, CA 94115',
    lat: 37.7865,
    lng: -122.4385,
    notes: 'Last seen normal 35 mins ago. Facial droop and severe aphasia noted.'
  },
  {
    title: 'Elderly Fall with Hip Fracture',
    severity: 'Level 3 - Urgent' as CallSeverity,
    complaint: 'Mechanical Fall from Standing, Inability to Bear Weight',
    address: '1350 7th Ave, San Francisco, CA 94122',
    lat: 37.7631,
    lng: -122.4645,
    notes: '82yo female, severe right hip pain with external rotation. Stable vitals.'
  }
];

export const CallIntakeModal: React.FC<CallIntakeModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [callerInfo, setCallerInfo] = useState('Bystander / 911 Caller');
  const [callerPhone, setCallerPhone] = useState('(415) 555-0199');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [address, setAddress] = useState('Market St & 3rd St, San Francisco, CA');
  const [lat, setLat] = useState<number>(37.7885);
  const [lng, setLng] = useState<number>(-122.4015);
  const [severity, setSeverity] = useState<CallSeverity>('Level 1 - Resuscitation');
  const [patientNotes, setPatientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setChiefComplaint(preset.complaint);
    setSeverity(preset.severity);
    setAddress(preset.address);
    setLat(preset.lat);
    setLng(preset.lng);
    setPatientNotes(preset.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint || !address) return;

    setSubmitting(true);
    try {
      await onSubmit({
        caller_info: callerInfo,
        caller_phone: callerPhone,
        chief_complaint: chiefComplaint,
        lat,
        lng,
        address,
        severity,
        patient_notes: patientNotes
      });
      onClose();
    } catch (err: any) {
      alert('Error creating call: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Emergency 911 Call Intake</h2>
              <p className="text-xs text-slate-400">Create incident for geospatial routing & hospital matching</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Quick Emergency Scenario Presets:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 text-left transition hover:bg-slate-800/40 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-red-400 transition">{p.title}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      p.severity.includes('Level 1') ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {p.severity.split(' - ')[0]}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{p.complaint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Severity Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Triage Severity Level <span className="text-red-400">*</span>
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as CallSeverity)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="Level 1 - Resuscitation">Level 1 - Resuscitation (Immediate Threat)</option>
                <option value="Level 2 - Emergent">Level 2 - Emergent (High Risk / Time Sensitive)</option>
                <option value="Level 3 - Urgent">Level 3 - Urgent (Moderate Distress)</option>
                <option value="Level 4 - Less Urgent">Level 4 - Less Urgent</option>
                <option value="Level 5 - Non-Urgent">Level 5 - Non-Urgent</option>
              </select>
            </div>

            {/* Chief Complaint */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chief Complaint / Nature of Emergency <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. STEMI, Unresponsive, Motor Collision"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Location & Coordinates */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Incident Scene Address & Coordinates <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address or intersection in San Francisco"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] text-slate-400">Latitude:</span>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Longitude:</span>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Caller Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Caller Identification</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={callerInfo}
                  onChange={(e) => setCallerInfo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Callback Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Triage & Clinical Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Triage & Clinical Dispatch Notes</label>
            <textarea
              rows={2}
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              placeholder="Clinical symptoms, patient age, consciousness, hazard warnings..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4" />
              {submitting ? 'Registering Call...' : 'Create & Match Available Units'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
