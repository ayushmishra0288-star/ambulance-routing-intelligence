/**
 * Hospital Intake Domain Service
 * Handles hospital capacity status, specialty registry, and active intake queues.
 */

import { db } from '../db/database.js';
import { Hospital, HospitalCapacityStatus, DispatchJob } from '../../src/types/index.js';
import { ioEmitter } from '../socket/socket.handler.js';

export class HospitalService {
  public static getAllHospitals(): Hospital[] {
    return Array.from(db.hospitals.values());
  }

  public static getHospitalById(id: string): Hospital | undefined {
    return db.hospitals.get(id);
  }

  public static updateCapacity(id: string, capacityStatus: HospitalCapacityStatus, availableBeds?: number): Hospital {
    const hospital = db.hospitals.get(id);
    if (!hospital) throw new Error(`Hospital ${id} not found`);

    hospital.capacity_status = capacityStatus;
    if (availableBeds !== undefined) {
      hospital.available_beds = availableBeds;
    }

    ioEmitter.emitToAll('hospital:capacity_updated', hospital);
    return hospital;
  }

  public static getIntakeQueue(hospitalId: string): DispatchJob[] {
    const activeJobs: DispatchJob[] = [];
    for (const job of db.dispatchJobs.values()) {
      if (job.hospital_id === hospitalId && job.status !== 'Completed' && job.status !== 'Cancelled') {
        const amb = db.ambulances.get(job.ambulance_id);
        const call = db.emergencyCalls.get(job.call_id);
        const hosp = db.hospitals.get(job.hospital_id);
        activeJobs.push({
          ...job,
          ambulance: amb,
          call,
          hospital: hosp
        });
      }
    }

    // Sort by priority and ETA
    activeJobs.sort((a, b) => {
      const getSevRank = (sev?: string) => {
        if (!sev) return 99;
        if (sev.includes('Level 1')) return 1;
        if (sev.includes('Level 2')) return 2;
        if (sev.includes('Level 3')) return 3;
        return 4;
      };
      const rankDiff = getSevRank(a.call?.severity) - getSevRank(b.call?.severity);
      if (rankDiff !== 0) return rankDiff;
      return a.eta_seconds - b.eta_seconds;
    });

    return activeJobs;
  }

  public static acknowledgePatientIntake(hospitalId: string, jobId: string, bedAssignment?: string): DispatchJob {
    const job = db.dispatchJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.hospital_id !== hospitalId) throw new Error('Job assigned to a different facility');

    const event = db.recordStatusEvent(
      job.id,
      'HOSPITAL_ACKNOWLEDGED',
      `Hospital intake coordinator acknowledged patient. Assigned Bay: ${bedAssignment || 'Emergency Bay 01'}`
    );

    ioEmitter.emitToRole('dispatcher', 'status:event', event);
    ioEmitter.emitToAmbulance(job.ambulance_id, 'job:hospital_ready', {
      jobId: job.id,
      hospitalName: db.hospitals.get(hospitalId)?.name,
      bedAssignment: bedAssignment || 'Trauma Bay 1'
    });

    return job;
  }
}
