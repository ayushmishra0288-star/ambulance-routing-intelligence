/**
 * Ambulance Intelligence Routing (AIR) - Single-City MVP
 * Main Application Shell & Role Router
 */

import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  UserRole, 
  Ambulance, 
  Driver, 
  Hospital, 
  EmergencyCall, 
  DispatchJob, 
  StatusEvent 
} from './types/index.js';
import { api, setApiAuthToken } from './services/api.js';
import { getSocket, registerSocketClient } from './services/socket.js';
import { Navbar } from './components/Navbar.js';
import { DispatcherConsole } from './components/dispatcher/DispatcherConsole.js';
import { DriverPWA } from './components/driver/DriverPWA.js';
import { HospitalPortal } from './components/hospital/HospitalPortal.js';
import { FleetAdmin } from './components/admin/FleetAdmin.js';
import { CallIntakeModal } from './components/CallIntakeModal.js';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('dispatcher');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [calls, setCalls] = useState<EmergencyCall[]>([]);
  const [jobs, setJobs] = useState<DispatchJob[]>([]);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [currentAmbulanceId, setCurrentAmbulanceId] = useState<string>('amb-1');
  const [currentHospitalId, setCurrentHospitalId] = useState<string>('hosp-1');
  const [connected, setConnected] = useState<boolean>(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);

  const [stats, setStats] = useState({
    availableAmbulances: 0,
    totalAmbulances: 0,
    activeJobs: 0,
    pendingCalls: 0,
    availableBeds: 0
  });

  // Fetch full state from backend
  const loadFullState = async () => {
    try {
      const [
        ambRes,
        drvRes,
        hospRes,
        callRes,
        jobRes,
        evtRes,
        statRes
      ] = await Promise.all([
        api.getAmbulances(),
        api.getDrivers(),
        api.getHospitals(),
        api.getCalls(),
        api.getJobs(),
        api.getStatusEvents(),
        api.getStats()
      ]);

      setAmbulances(ambRes.ambulances);
      setDrivers(drvRes.drivers);
      setHospitals(hospRes.hospitals);
      setCalls(callRes.calls);
      setJobs(jobRes.jobs);
      setEvents(evtRes.events);
      setStats({
        availableAmbulances: statRes.availableAmbulances,
        totalAmbulances: statRes.totalAmbulances,
        activeJobs: statRes.activeJobs,
        pendingCalls: statRes.pendingCalls,
        availableBeds: statRes.availableBeds
      });
    } catch (err) {
      console.error('Error loading application state:', err);
    }
  };

  // Initial Auth & Socket Setup
  useEffect(() => {
    api.getUsers().then(res => {
      setUsers(res.users);
      const defaultDispatcher = res.users.find(u => u.role === 'dispatcher') || res.users[0];
      if (defaultDispatcher) {
        api.login(defaultDispatcher.id).then(authRes => {
          setApiAuthToken(authRes.token);
          setCurrentUser(authRes.user);
          registerSocketClient(defaultDispatcher.role);
        });
      }
    });

    loadFullState();

    const socket = getSocket();
    socket.on('connect', () => {
      setConnected(true);
      registerSocketClient(currentRole, currentAmbulanceId, currentHospitalId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Realtime event listeners
    socket.on('call:created', (newCall: EmergencyCall) => {
      setCalls(prev => [newCall, ...prev.filter(c => c.id !== newCall.id)]);
      loadFullState();
    });

    socket.on('job:created', (newJob: DispatchJob) => {
      setJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)]);
      loadFullState();
    });

    socket.on('job:updated', (data: { job: DispatchJob; event: StatusEvent }) => {
      setJobs(prev => prev.map(j => (j.id === data.job.id ? data.job : j)));
      if (data.event) {
        setEvents(prev => [data.event, ...prev]);
      }
      loadFullState();
    });

    socket.on('location:update', (payload: { ambulanceId: string; lat: number; lng: number; speed?: number; heading?: number }) => {
      setAmbulances(prev => prev.map(a => {
        if (a.id === payload.ambulanceId) {
          return {
            ...a,
            current_lat: payload.lat,
            current_lng: payload.lng,
            speed_kmh: payload.speed,
            heading_deg: payload.heading,
            updated_at: new Date().toISOString()
          };
        }
        return a;
      }));
    });

    socket.on('ambulance:updated', (amb: Ambulance) => {
      setAmbulances(prev => prev.map(a => (a.id === amb.id ? amb : a)));
      loadFullState();
    });

    socket.on('hospital:capacity_updated', (hosp: Hospital) => {
      setHospitals(prev => prev.map(h => (h.id === hosp.id ? hosp : h)));
      loadFullState();
    });

    socket.on('status:event', (evt: StatusEvent) => {
      setEvents(prev => [evt, ...prev.filter(e => e.id !== evt.id)]);
    });

    return () => {
      socket.off('call:created');
      socket.off('job:created');
      socket.off('job:updated');
      socket.off('location:update');
      socket.off('ambulance:updated');
      socket.off('hospital:capacity_updated');
      socket.off('status:event');
    };
  }, []);

  // Handle Role Change
  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    registerSocketClient(role, currentAmbulanceId, currentHospitalId);
  };

  // Handle Reset Seed
  const handleResetSeed = async () => {
    try {
      await api.resetSeed();
      await loadFullState();
      alert('Simulation environment reset with standard demo ambulances and hospitals.');
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    }
  };

  // Create Emergency Call
  const handleCreateCall = async (callData: any) => {
    await api.createCall(callData);
    await loadFullState();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-red-500 selection:text-white">
      {/* Top Navbar with live telemetry */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onResetSeed={handleResetSeed}
        stats={stats}
        connected={connected}
        onOpenCallModal={() => setIsCallModalOpen(true)}
      />

      {/* Main Role-Based Views */}
      <main className="flex-1">
        {currentRole === 'dispatcher' && (
          <DispatcherConsole
            calls={calls}
            ambulances={ambulances}
            hospitals={hospitals}
            jobs={jobs}
            events={events}
            onRefresh={loadFullState}
            onOpenCallModal={() => setIsCallModalOpen(true)}
          />
        )}

        {currentRole === 'driver' && (
          <DriverPWA
            ambulances={ambulances}
            currentAmbulanceId={currentAmbulanceId}
            onSelectAmbulance={setCurrentAmbulanceId}
            onRefresh={loadFullState}
          />
        )}

        {currentRole === 'hospital' && (
          <HospitalPortal
            hospitals={hospitals}
            currentHospitalId={currentHospitalId}
            onSelectHospital={setCurrentHospitalId}
            onRefresh={loadFullState}
          />
        )}

        {currentRole === 'admin' && (
          <FleetAdmin
            ambulances={ambulances}
            drivers={drivers}
            hospitals={hospitals}
            onRefresh={loadFullState}
          />
        )}
      </main>

      {/* 911 Call Intake Modal */}
      <CallIntakeModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        onSubmit={handleCreateCall}
      />
    </div>
  );
}
