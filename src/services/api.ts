/**
 * Frontend REST API Client
 */

import { 
  UserProfile, 
  Ambulance, 
  Driver, 
  Hospital, 
  EmergencyCall, 
  DispatchJob, 
  StatusEvent, 
  RankedAmbulance, 
  HospitalSuggestion, 
  AmbulanceStatus, 
  HospitalCapacityStatus, 
  JobStatus 
} from '../types/index.js';

let authToken: string | null = localStorage.getItem('air_token');

export function setApiAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('air_token', token);
  } else {
    localStorage.removeItem('air_token');
  }
}

export function getApiAuthToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) errMsg = body.error;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  getUsers: () => request<{ users: UserProfile[] }>('/auth/users'),
  login: (userId?: string, username?: string) => 
    request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId, username })
    }),
  getMe: () => request<{ user: UserProfile }>('/auth/me'),

  // Fleet
  getAmbulances: () => request<{ ambulances: Ambulance[] }>('/fleet/ambulances'),
  updateAmbulanceStatus: (id: string, status: AmbulanceStatus) => 
    request<{ ambulance: Ambulance }>(`/fleet/ambulances/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
  getDrivers: () => request<{ drivers: Driver[] }>('/fleet/drivers'),

  // Hospitals
  getHospitals: () => request<{ hospitals: Hospital[] }>('/hospitals'),
  updateHospitalCapacity: (id: string, capacity_status: HospitalCapacityStatus, available_beds?: number) =>
    request<{ hospital: Hospital }>(`/hospitals/${id}/capacity`, {
      method: 'PATCH',
      body: JSON.stringify({ capacity_status, available_beds })
    }),
  getHospitalIntakeQueue: (hospitalId: string) =>
    request<{ queue: DispatchJob[] }>(`/hospitals/${hospitalId}/intake-queue`),
  acknowledgeIntake: (hospitalId: string, jobId: string, bedAssignment: string) =>
    request<{ job: DispatchJob }>(`/hospitals/${hospitalId}/intake-queue/${jobId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ bedAssignment })
    }),

  // Dispatch
  getCalls: () => request<{ calls: EmergencyCall[] }>('/dispatch/calls'),
  createCall: (callData: {
    caller_info: string;
    caller_phone: string;
    chief_complaint: string;
    lat: number;
    lng: number;
    address: string;
    severity: string;
    patient_notes?: string;
  }) =>
    request<{ call: EmergencyCall }>('/dispatch/calls', {
      method: 'POST',
      body: JSON.stringify(callData)
    }),
  getRankedAmbulances: (callId: string) =>
    request<{ ranked: RankedAmbulance[] }>(`/dispatch/calls/${callId}/ranked-ambulances`),
  getSuggestedHospitals: (callId: string) =>
    request<{ suggestions: HospitalSuggestion[] }>(`/dispatch/calls/${callId}/suggested-hospitals`),
  assignJob: (call_id: string, ambulance_id: string, hospital_id: string) =>
    request<{ job: DispatchJob }>('/dispatch/assign', {
      method: 'POST',
      body: JSON.stringify({ call_id, ambulance_id, hospital_id })
    }),
  getJobs: () => request<{ jobs: DispatchJob[] }>('/dispatch/jobs'),
  getJobById: (id: string) => request<{ job: DispatchJob }>(`/dispatch/jobs/${id}`),
  updateJobStatus: (id: string, status: JobStatus, notes?: string, currentLat?: number, currentLng?: number) =>
    request<{ job: DispatchJob }>(`/dispatch/jobs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes, currentLat, currentLng })
    }),
  getStatusEvents: () => request<{ events: StatusEvent[] }>('/dispatch/events'),

  // Driver
  getActiveJobForAmbulance: (ambulanceId: string) =>
    request<{ activeJob: DispatchJob | null }>(`/driver/active-job/${ambulanceId}`),
  postDriverLocation: (payload: { ambulanceId: string; lat: number; lng: number; speed?: number; heading?: number; jobId?: string }) =>
    request<{ status: string }>('/driver/location', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // System
  resetSeed: () => request<{ status: string; message: string }>('/system/seed', { method: 'POST' }),
  getStats: () => request<{
    availableAmbulances: number;
    totalAmbulances: number;
    activeJobs: number;
    pendingCalls: number;
    availableBeds: number;
    totalBeds: number;
    hospitalsCount: number;
  }>('/system/stats')
};
