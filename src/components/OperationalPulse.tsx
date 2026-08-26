import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  Radio,
  ShieldCheck,
  Truck
} from 'lucide-react';
import {
  Ambulance,
  DispatchJob,
  EmergencyCall,
  Hospital,
  UserRole
} from '../types/index.js';

interface OperationalPulseProps {
  ambulances: Ambulance[];
  hospitals: Hospital[];
  calls: EmergencyCall[];
  jobs: DispatchJob[];
  connected: boolean;
  currentRole: UserRole;
}

export const OperationalPulse: React.FC<OperationalPulseProps> = ({
  ambulances,
  hospitals,
  calls,
  jobs,
  connected,
  currentRole
}) => {
  const availableUnits = ambulances.filter(unit => unit.status === 'Available').length;
  const pendingCalls = calls.filter(call => call.status === 'Pending');
  const priorityCalls = pendingCalls.filter(call =>
    call.severity.includes('Level 1') || call.severity.includes('Level 2')
  ).length;
  const activeJobs = jobs.filter(job => job.status !== 'Completed' && job.status !== 'Cancelled');
  const acceptingHospitals = hospitals.filter(
    hospital =>
      hospital.available_beds > 0 &&
      (hospital.capacity_status === 'Normal' || hospital.capacity_status === 'High')
  ).length;

  const fleetCoverage = ambulances.length
    ? Math.round((availableUnits / ambulances.length) * 100)
    : 0;
  const hospitalCoverage = hospitals.length
    ? Math.round((acceptingHospitals / hospitals.length) * 100)
    : 0;

  const etaValues = activeJobs
    .map(job => Math.max(1, Math.round(job.eta_seconds / 60)))
    .sort((a, b) => a - b);
  const medianEta = etaValues.length
    ? etaValues[Math.floor(etaValues.length / 2)]
    : null;

  const state = !connected
    ? {
        label: 'Telemetry interrupted',
        tone: 'rose',
        detail: 'Live updates are offline. Confirm connectivity before dispatching.',
        action: 'Restore the real-time data link'
      }
    : priorityCalls > availableUnits
      ? {
          label: 'Priority surge detected',
          tone: 'rose',
          detail: `${priorityCalls} high-priority calls are competing for ${availableUnits} available units.`,
          action: 'Dispatch the highest-severity queue first'
        }
      : acceptingHospitals === 0
        ? {
            label: 'Hospital diversion risk',
            tone: 'amber',
            detail: 'No receiving facility currently has an accepting capacity state.',
            action: 'Coordinate regional intake escalation'
          }
        : fleetCoverage < 35
          ? {
              label: 'Fleet coverage constrained',
              tone: 'amber',
              detail: `Only ${fleetCoverage}% of the fleet is immediately available.`,
              action: 'Re-stage the nearest available units'
            }
          : {
              label: 'City readiness balanced',
              tone: 'emerald',
              detail: `${availableUnits} units and ${acceptingHospitals} hospitals can accept new missions.`,
              action: 'Maintain live coverage and monitor demand'
            };

  const toneStyles = {
    emerald: {
      dot: 'bg-emerald-400',
      badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
      glow: 'from-emerald-500/20'
    },
    amber: {
      dot: 'bg-amber-400',
      badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
      glow: 'from-amber-500/20'
    },
    rose: {
      dot: 'bg-rose-400',
      badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
      glow: 'from-rose-500/20'
    }
  }[state.tone as 'emerald' | 'amber' | 'rose'];

  return (
    <section className="air-grid border-b border-cyan-400/10 bg-slate-950/90 px-4 py-3">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-3 xl:grid-cols-[1.3fr_2fr]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-2xl shadow-cyan-950/20">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${toneStyles.glow} via-transparent to-cyan-500/10`} />
          <div className="relative flex h-full items-center gap-4">
            <div className="air-orbit relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
              <Radio className="h-5 w-5 text-cyan-300" />
              <span className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-full ${toneStyles.dot} ring-4 ring-slate-900`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                  AIR city pulse
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneStyles.badge}`}>
                  {state.label}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-extrabold text-white">{state.detail}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <span className="capitalize">{currentRole} view</span>
                <ArrowRight className="h-3 w-3 text-cyan-400" />
                <span className="text-slate-200">{state.action}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <PulseMetric
            icon={<Truck className="h-4 w-4" />}
            label="Fleet coverage"
            value={`${availableUnits}/${ambulances.length}`}
            hint={`${fleetCoverage}% dispatch-ready`}
            progress={fleetCoverage}
            tone="emerald"
          />
          <PulseMetric
            icon={priorityCalls ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            label="Priority queue"
            value={String(priorityCalls)}
            hint={`${pendingCalls.length} total pending`}
            progress={pendingCalls.length ? Math.min(100, (priorityCalls / pendingCalls.length) * 100) : 0}
            tone={priorityCalls ? 'rose' : 'cyan'}
          />
          <PulseMetric
            icon={<Building2 className="h-4 w-4" />}
            label="Accepting facilities"
            value={`${acceptingHospitals}/${hospitals.length}`}
            hint={`${hospitalCoverage}% network ready`}
            progress={hospitalCoverage}
            tone="violet"
          />
          <PulseMetric
            icon={medianEta ? <Clock className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            label="Median mission ETA"
            value={medianEta ? `${medianEta}m` : 'Ready'}
            hint={activeJobs.length ? `${activeJobs.length} active missions` : 'No active missions'}
            progress={medianEta ? Math.max(8, Math.min(100, 100 - medianEta * 4)) : 100}
            tone="cyan"
          />
        </div>
      </div>
    </section>
  );
};

interface PulseMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  progress: number;
  tone: 'emerald' | 'rose' | 'violet' | 'cyan';
}

const PulseMetric: React.FC<PulseMetricProps> = ({
  icon,
  label,
  value,
  hint,
  progress,
  tone
}) => {
  const tones = {
    emerald: { icon: 'text-emerald-300 bg-emerald-400/10', bar: 'bg-emerald-400' },
    rose: { icon: 'text-rose-300 bg-rose-400/10', bar: 'bg-rose-400' },
    violet: { icon: 'text-violet-300 bg-violet-400/10', bar: 'bg-violet-400' },
    cyan: { icon: 'text-cyan-300 bg-cyan-400/10', bar: 'bg-cyan-400' }
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-lg shadow-slate-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones.icon}`}>{icon}</span>
        <span className="font-mono text-lg font-black tracking-tight text-white">{value}</span>
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 text-[10px] text-slate-500">{hint}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${tones.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
};
