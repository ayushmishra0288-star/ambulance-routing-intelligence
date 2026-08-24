/**
 * Database Layer with PostGIS Geospatial Engine emulation & Audit trail
 */

import { 
  Ambulance, 
  Driver, 
  Hospital, 
  EmergencyCall, 
  DispatchJob, 
  StatusEvent, 
  UserProfile 
} from '../../src/types/index.js';

// Calculate Haversine distance (equivalent to PostGIS ST_Distance(geom1::geography, geom2::geography))
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export class Database {
  private static instance: Database;

  public ambulances: Map<string, Ambulance> = new Map();
  public drivers: Map<string, Driver> = new Map();
  public hospitals: Map<string, Hospital> = new Map();
  public emergencyCalls: Map<string, EmergencyCall> = new Map();
  public dispatchJobs: Map<string, DispatchJob> = new Map();
  public statusEvents: StatusEvent[] = [];
  public users: Map<string, UserProfile> = new Map();

  private constructor() {
    this.seedInitialData();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public seedInitialData() {
    this.ambulances.clear();
    this.drivers.clear();
    this.hospitals.clear();
    this.emergencyCalls.clear();
    this.dispatchJobs.clear();
    this.statusEvents = [];
    this.users.clear();

    // 1. Seed Users
    const defaultUsers: UserProfile[] = [
      { id: 'usr-1', username: 'dispatcher_sarah', name: 'Sarah Jenkins', role: 'dispatcher', phone: '415-555-0101' },
      { id: 'usr-2', username: 'driver_marcus', name: 'Marcus Vance (EMT-P)', role: 'driver', ambulance_id: 'amb-1', phone: '415-555-0102' },
      { id: 'usr-3', username: 'driver_elena', name: 'Elena Rostova (EMT-B)', role: 'driver', ambulance_id: 'amb-2', phone: '415-555-0103' },
      { id: 'usr-4', username: 'driver_darius', name: 'Darius Thorne (Paramedic)', role: 'driver', ambulance_id: 'amb-3', phone: '415-555-0104' },
      { id: 'usr-5', username: 'hospital_zsfg', name: 'Dr. Rachel Chen (Trauma Intake)', role: 'hospital', hospital_id: 'hosp-1', phone: '415-555-0105' },
      { id: 'usr-6', username: 'admin_root', name: 'Chief Operations Officer', role: 'admin', phone: '415-555-0100' }
    ];
    defaultUsers.forEach(u => this.users.set(u.id, u));

    // 2. Seed Hospitals (San Francisco Metro)
    const defaultHospitals: Hospital[] = [
      {
        id: 'hosp-1',
        name: 'Zuckerberg San Francisco General (ZSFG)',
        lat: 37.7558,
        lng: -122.4045,
        address: '1001 Potrero Ave, San Francisco, CA 94110',
        specialties: ['Level I Trauma', 'Burn Center', 'Comprehensive Stroke', 'Pediatric Trauma', 'Emergency Resuscitation'],
        capacity_status: 'Normal',
        trauma_level: 'Level I',
        total_beds: 48,
        available_beds: 14,
        contact_phone: '(415) 206-8000'
      },
      {
        id: 'hosp-2',
        name: 'UCSF Medical Center at Mission Bay',
        lat: 37.7677,
        lng: -122.3912,
        address: '1825 4th St, San Francisco, CA 94158',
        specialties: ['Comprehensive Stroke', 'Cardiology & STEMI', 'Pediatric ICU', 'Oncology', 'High-Risk Surgical'],
        capacity_status: 'Normal',
        trauma_level: 'Level II',
        total_beds: 40,
        available_beds: 9,
        contact_phone: '(415) 353-1000'
      },
      {
        id: 'hosp-3',
        name: 'CPMC Van Ness Campus (Sutter Health)',
        lat: 37.7852,
        lng: -122.4219,
        address: '1101 Van Ness Ave, San Francisco, CA 94109',
        specialties: ['Cardiology & STEMI', 'Primary Stroke', 'General Emergency', 'Obstetrics & Neonatal'],
        capacity_status: 'High',
        trauma_level: 'Level II',
        total_beds: 36,
        available_beds: 4,
        contact_phone: '(415) 600-6000'
      },
      {
        id: 'hosp-4',
        name: 'Kaiser Permanente San Francisco Medical Center',
        lat: 37.7825,
        lng: -122.4431,
        address: '2425 Geary Blvd, San Francisco, CA 94115',
        specialties: ['Primary Stroke', 'General Emergency', 'Respiratory Care', 'Urgent Care'],
        capacity_status: 'Normal',
        trauma_level: 'Community',
        total_beds: 30,
        available_beds: 8,
        contact_phone: '(415) 833-2000'
      },
      {
        id: 'hosp-5',
        name: 'St. Mary\'s Medical Center',
        lat: 37.7728,
        lng: -122.4539,
        address: '450 Stanyan St, San Francisco, CA 94117',
        specialties: ['Spine & Orthopedic', 'General Emergency', 'Rehabilitation'],
        capacity_status: 'Diverted',
        trauma_level: 'Community',
        total_beds: 22,
        available_beds: 1,
        contact_phone: '(415) 668-1000'
      }
    ];
    defaultHospitals.forEach(h => this.hospitals.set(h.id, h));

    // 3. Seed Ambulances across SF Staging Posts
    const defaultAmbulances: Ambulance[] = [
      {
        id: 'amb-1',
        plate: 'CA-9EM-4101',
        call_sign: 'MEDIC-101 (SoMa Staging)',
        equipment_level: 'Critical Care',
        status: 'Available',
        current_lat: 37.7785,
        current_lng: -122.4065,
        speed_kmh: 0,
        heading_deg: 45,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-2',
        plate: 'CA-9EM-4102',
        call_sign: 'MEDIC-102 (Mission Staging)',
        equipment_level: 'Advanced',
        status: 'Available',
        current_lat: 37.7599,
        current_lng: -122.4189,
        speed_kmh: 0,
        heading_deg: 90,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-3',
        plate: 'CA-9EM-4103',
        call_sign: 'MEDIC-103 (Financial District)',
        equipment_level: 'Critical Care',
        status: 'Available',
        current_lat: 37.7938,
        current_lng: -122.3995,
        speed_kmh: 0,
        heading_deg: 180,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-4',
        plate: 'CA-9EM-4104',
        call_sign: 'RESCUE-104 (Richmond Post)',
        equipment_level: 'Advanced',
        status: 'Available',
        current_lat: 37.7798,
        current_lng: -122.4645,
        speed_kmh: 0,
        heading_deg: 270,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-5',
        plate: 'CA-9EM-4105',
        call_sign: 'BASIC-105 (Sunset Station)',
        equipment_level: 'Basic',
        status: 'Available',
        current_lat: 37.7542,
        current_lng: -122.4764,
        speed_kmh: 0,
        heading_deg: 0,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-6',
        plate: 'CA-9EM-4106',
        call_sign: 'MEDIC-106 (Marina / Presidio)',
        equipment_level: 'Advanced',
        status: 'Available',
        current_lat: 37.8012,
        current_lng: -122.4365,
        speed_kmh: 0,
        heading_deg: 135,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-7',
        plate: 'CA-9EM-4107',
        call_sign: 'RESCUE-107 (Civic Center)',
        equipment_level: 'Critical Care',
        status: 'Available',
        current_lat: 37.7812,
        current_lng: -122.4172,
        speed_kmh: 0,
        heading_deg: 220,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-8',
        plate: 'CA-9EM-4108',
        call_sign: 'BASIC-108 (Bayview Post)',
        equipment_level: 'Basic',
        status: 'Available',
        current_lat: 37.7321,
        current_lng: -122.3895,
        speed_kmh: 0,
        heading_deg: 310,
        updated_at: new Date().toISOString()
      },
      {
        id: 'amb-9',
        plate: 'CA-9EM-4109',
        call_sign: 'MEDIC-109 (Depot Maintenance)',
        equipment_level: 'Advanced',
        status: 'Maintenance',
        current_lat: 37.7490,
        current_lng: -122.4020,
        speed_kmh: 0,
        heading_deg: 0,
        updated_at: new Date().toISOString()
      }
    ];
    defaultAmbulances.forEach(a => this.ambulances.set(a.id, a));

    // 4. Seed Drivers
    const defaultDrivers: Driver[] = [
      { id: 'drv-1', ambulance_id: 'amb-1', name: 'Marcus Vance (EMT-P)', phone: '415-555-0102', status: 'On Duty' },
      { id: 'drv-2', ambulance_id: 'amb-2', name: 'Elena Rostova (EMT-B)', phone: '415-555-0103', status: 'On Duty' },
      { id: 'drv-3', ambulance_id: 'amb-3', name: 'Darius Thorne (Paramedic)', phone: '415-555-0104', status: 'On Duty' },
      { id: 'drv-4', ambulance_id: 'amb-4', name: 'Chloe Nguyen (Paramedic)', phone: '415-555-0114', status: 'On Duty' },
      { id: 'drv-5', ambulance_id: 'amb-5', name: 'Samira Patel (EMT-B)', phone: '415-555-0115', status: 'On Duty' },
      { id: 'drv-6', ambulance_id: 'amb-6', name: 'Liam O\'Connor (EMT-P)', phone: '415-555-0116', status: 'On Duty' },
      { id: 'drv-7', ambulance_id: 'amb-7', name: 'Aaliyah Washington (Paramedic)', phone: '415-555-0117', status: 'On Duty' },
      { id: 'drv-8', ambulance_id: 'amb-8', name: 'Brett Miller (EMT-B)', phone: '415-555-0118', status: 'On Duty' }
    ];
    defaultDrivers.forEach(d => {
      this.drivers.set(d.id, d);
      const amb = this.ambulances.get(d.ambulance_id);
      if (amb) amb.driver = d;
    });

    // 5. Seed Initial Pending Demo Emergency Calls
    const defaultCalls: EmergencyCall[] = [
      {
        id: 'call-101',
        caller_info: 'Bystander (Johnathan Doe)',
        caller_phone: '(415) 555-9921',
        chief_complaint: 'Suspected Acute STEMI / Severe Crushing Chest Pain',
        lat: 37.7879,
        lng: -122.4075,
        address: 'Market St & 4th St, San Francisco, CA 94103',
        severity: 'Level 1 - Resuscitation',
        status: 'Pending',
        patient_notes: '58yo male conscious but diaphoresis noted, radiating left arm pain.',
        created_at: new Date(Date.now() - 3 * 60000).toISOString()
      },
      {
        id: 'call-102',
        caller_info: 'Security Dispatcher',
        caller_phone: '(415) 555-8812',
        chief_complaint: 'Pedestrian vs Vehicle Collision with Head Trauma',
        lat: 37.7645,
        lng: -122.4215,
        address: '16th St & Valencia St, San Francisco, CA 94103',
        severity: 'Level 2 - Emergent',
        status: 'Pending',
        patient_notes: 'Young adult cyclist struck by SUV, brief LOC, bleeding from scalp.',
        created_at: new Date(Date.now() - 8 * 60000).toISOString()
      }
    ];
    defaultCalls.forEach(c => this.emergencyCalls.set(c.id, c));
  }

  /**
   * PostGIS equivalent:
   * SELECT * FROM ambulances
   * WHERE status = 'Available'
   *   AND ST_DWithin(ST_MakePoint(current_lng, current_lat)::geography, ST_MakePoint(lng, lat)::geography, radiusMeters)
   * ORDER BY ST_Distance(ST_MakePoint(current_lng, current_lat)::geography, ST_MakePoint(lng, lat)::geography)
   * LIMIT limit;
   */
  public queryAvailableAmbulancesWithinRadius(
    targetLat: number,
    targetLng: number,
    radiusKm: number = 25,
    limit: number = 12
  ): Array<{ ambulance: Ambulance; distanceKm: number }> {
    const candidates: Array<{ ambulance: Ambulance; distanceKm: number }> = [];

    for (const amb of this.ambulances.values()) {
      if (amb.status !== 'Available') continue;

      const distKm = calculateHaversineDistanceKm(amb.current_lat, amb.current_lng, targetLat, targetLng);
      if (distKm <= radiusKm) {
        candidates.push({ ambulance: { ...amb }, distanceKm: distKm });
      }
    }

    // Sort ascending by geographical distance
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);

    return candidates.slice(0, limit);
  }

  /**
   * Record a mandatory audit trail event whenever dispatch_jobs.status is updated
   */
  public recordStatusEvent(jobId: string, eventType: string, notes?: string, lat?: number, lng?: number): StatusEvent {
    const event: StatusEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      job_id: jobId,
      event_type: eventType,
      notes,
      lat,
      lng,
      created_at: new Date().toISOString()
    };
    this.statusEvents.unshift(event);
    return event;
  }
}

export const db = Database.getInstance();
