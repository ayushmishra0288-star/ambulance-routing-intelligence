export type AmbulanceStatus = 
  | 'Available' 
  | 'Assigned' 
  | 'En Route' 
  | 'On Scene' 
  | 'Transporting' 
  | 'At Hospital' 
  | 'Maintenance';

export type EquipmentLevel = 'Basic' | 'Advanced' | 'Critical Care';

export type HospitalCapacityStatus = 'Normal' | 'High' | 'Diverted' | 'Full';

export type CallSeverity = 
  | 'Level 1 - Resuscitation' 
  | 'Level 2 - Emergent' 
  | 'Level 3 - Urgent' 
  | 'Level 4 - Less Urgent' 
  | 'Level 5 - Non-Urgent';

export type CallStatus = 'Pending' | 'Dispatched' | 'Active' | 'Resolved' | 'Cancelled';

export type JobStatus = 
  | 'Assigned' 
  | 'En Route' 
  | 'On Scene' 
  | 'Transporting' 
  | 'At Hospital' 
  | 'Completed' 
  | 'Cancelled';

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'hospital';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  ambulance_id?: string;
  hospital_id?: string;
  phone?: string;
}

export interface Ambulance {
  id: string;
  plate: string;
  call_sign: string;
  equipment_level: EquipmentLevel;
  status: AmbulanceStatus;
  current_lat: number;
  current_lng: number;
  speed_kmh?: number;
  heading_deg?: number;
  updated_at: string;
  driver?: Driver;
}

export interface Driver {
  id: string;
  ambulance_id: string;
  name: string;
  phone: string;
  status: 'On Duty' | 'Off Duty' | 'On Break';
}

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  specialties: string[];
  capacity_status: HospitalCapacityStatus;
  trauma_level: 'Level I' | 'Level II' | 'Level III' | 'Community';
  total_beds: number;
  available_beds: number;
  contact_phone: string;
}

export interface EmergencyCall {
  id: string;
  caller_info: string;
  caller_phone: string;
  chief_complaint: string;
  lat: number;
  lng: number;
  address: string;
  severity: CallSeverity;
  status: CallStatus;
  patient_notes?: string;
  created_at: string;
}

export interface RouteStep {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
  modifier?: string;
  name?: string;
}

export interface DispatchJob {
  id: string;
  call_id: string;
  ambulance_id: string;
  hospital_id: string;
  status: JobStatus;
  assigned_at: string;
  eta_seconds: number;
  distance_meters: number;
  route_polyline: string; // Encoded polyline or coordinate array
  coordinates?: [number, number][]; // [lat, lng][] array for mapping
  turn_by_turn_steps?: RouteStep[];
  completed_at?: string | null;
  call?: EmergencyCall;
  ambulance?: Ambulance;
  hospital?: Hospital;
}

export interface StatusEvent {
  id: string;
  job_id: string;
  event_type: string;
  notes?: string;
  lat?: number;
  lng?: number;
  created_at: string;
}

export interface RankedAmbulance {
  ambulance: Ambulance;
  distance_km: number;
  eta_seconds: number;
  eta_formatted: string;
  match_score: number; // 0 - 100 calculated from ETA, equipment matching, and severity
  equipment_match: boolean;
  score_breakdown: {
    proximity_score: number;
    equipment_score: number;
    availability_score: number;
  };
}

export interface HospitalSuggestion {
  hospital: Hospital;
  distance_km: number;
  eta_seconds: number;
  eta_formatted: string;
  is_recommended: boolean;
  match_reasons: string[];
}

export interface DriverLocationPayload {
  ambulanceId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  jobId?: string;
}
