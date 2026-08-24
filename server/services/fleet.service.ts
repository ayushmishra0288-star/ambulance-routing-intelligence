/**
 * Fleet Management Service
 * Handles ambulance and driver registries, live location streaming, and telemetry cache.
 */

import { db } from '../db/database.js';
import { redis } from '../cache/redis.js';
import { Ambulance, Driver, AmbulanceStatus, DriverLocationPayload } from '../../src/types/index.js';
import { ioEmitter } from '../socket/socket.handler.js';

export class FleetService {
  public static getAllAmbulances(): Ambulance[] {
    return Array.from(db.ambulances.values());
  }

  public static getAmbulanceById(id: string): Ambulance | undefined {
    return db.ambulances.get(id);
  }

  public static updateAmbulanceStatus(id: string, status: AmbulanceStatus): Ambulance {
    const amb = db.ambulances.get(id);
    if (!amb) throw new Error(`Ambulance ${id} not found`);
    amb.status = status;
    amb.updated_at = new Date().toISOString();
    ioEmitter.emitToAll('ambulance:updated', amb);
    return amb;
  }

  public static async processDriverLocation(payload: DriverLocationPayload) {
    const { ambulanceId, lat, lng, speed, heading, jobId } = payload;
    const amb = db.ambulances.get(ambulanceId);
    if (!amb) return;

    amb.current_lat = lat;
    amb.current_lng = lng;
    amb.speed_kmh = speed || 0;
    amb.heading_deg = heading || 0;
    amb.updated_at = new Date().toISOString();

    // Cache in Redis with 30s TTL
    await redis.setLocation(ambulanceId, { lat, lng, speed, heading });

    // Fan-out to Dispatchers, Fleet, and associated Hospital if on active job
    ioEmitter.emitToAll('location:update', {
      ambulanceId,
      lat,
      lng,
      speed: speed || 0,
      heading: heading || 0,
      call_sign: amb.call_sign,
      status: amb.status,
      jobId
    });

    if (jobId) {
      const job = db.dispatchJobs.get(jobId);
      if (job && job.hospital_id) {
        ioEmitter.emitToHospital(job.hospital_id, 'hospital:ambulance_location', {
          jobId,
          ambulanceId,
          lat,
          lng,
          speed,
          heading
        });
      }
    }
  }

  public static getAllDrivers(): Driver[] {
    return Array.from(db.drivers.values());
  }

  public static createAmbulance(data: Partial<Ambulance>): Ambulance {
    const id = `amb-${Date.now()}`;
    const amb: Ambulance = {
      id,
      plate: data.plate || `CA-${Math.floor(1000 + Math.random() * 9000)}`,
      call_sign: data.call_sign || `UNIT-${Math.floor(100 + Math.random() * 900)}`,
      equipment_level: data.equipment_level || 'Advanced',
      status: 'Available',
      current_lat: data.current_lat || 37.7749,
      current_lng: data.current_lng || -122.4194,
      updated_at: new Date().toISOString()
    };
    db.ambulances.set(id, amb);
    ioEmitter.emitToAll('ambulance:created', amb);
    return amb;
  }
}
