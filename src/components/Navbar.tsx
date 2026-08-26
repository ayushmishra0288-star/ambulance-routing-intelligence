import React from 'react';
import { 
  Radio, 
  Truck, 
  Building2, 
  ShieldAlert, 
  RotateCcw, 
  Wifi, 
  Flame, 
  Activity, 
  CheckCircle2, 
  Layers 
} from 'lucide-react';
import { UserRole } from '../types/index.js';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onResetSeed: () => void;
  stats: {
    availableAmbulances: number;
    totalAmbulances: number;
    activeJobs: number;
    pendingCalls: number;
    availableBeds: number;
  };
  connected: boolean;
  onOpenCallModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  onResetSeed,
  stats,
  connected,
  onOpenCallModal
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-cyan-400/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-rose-500 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-300/30">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                <span className="tracking-[0.2em]">AIR</span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/50 font-mono font-bold tracking-normal">
                  COMMAND v2
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Rapid-response operating system</p>
          </div>
        </div>

        {/* System Telemetry Badges */}
        <div className="hidden 2xl:flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs font-mono">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Available:</span>
            <span className="text-emerald-400 font-bold">{stats.availableAmbulances}/{stats.totalAmbulances}</span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Active Missions:</span>
            <span className="text-blue-400 font-bold">{stats.activeJobs}</span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs font-mono">
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Intake Beds:</span>
            <span className="text-purple-400 font-bold">{stats.availableBeds}</span>
          </div>

          {stats.pendingCalls > 0 && (
            <div className="px-3 py-1 rounded-lg bg-red-950/70 border border-red-800/60 flex items-center gap-2 text-xs font-mono animate-pulse">
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-300 font-bold">{stats.pendingCalls} Pending Call{stats.pendingCalls > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Actions & Role Switcher */}
        <div className="flex items-center gap-3">
          {/* New Call Button */}
          <button
            onClick={onOpenCallModal}
            className="flex items-center gap-1.5 rounded-xl border border-rose-400/20 bg-gradient-to-r from-rose-600 to-red-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-600/30 transition-all hover:-translate-y-0.5 hover:shadow-rose-500/40 active:translate-y-0"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Create Incident</span>
          </button>

          {/* Role Switcher Tabs */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1 text-xs">
            <button
              onClick={() => onRoleChange('dispatcher')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'dispatcher'
                  ? 'bg-cyan-500 text-slate-950 shadow shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Command</span>
            </button>

            <button
              onClick={() => onRoleChange('driver')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'driver'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Responder</span>
            </button>

            <button
              onClick={() => onRoleChange('hospital')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'hospital'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Hospital</span>
            </button>

            <button
              onClick={() => onRoleChange('admin')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Network</span>
            </button>
          </div>

          {/* Reset Demo Seed */}
          <button
            onClick={onResetSeed}
            title="Reset to realistic demo scenario"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* WebSocket indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <Wifi className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </div>
        </div>
      </div>
    </header>
  );
};
