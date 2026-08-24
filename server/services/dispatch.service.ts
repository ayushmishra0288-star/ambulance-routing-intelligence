/**
 * Dispatch Domain Service
 * Handles emergency call intake, PostGIS geospatial pre-filter,
 * ETA matrix ranking with severity weighting, job assignment, and route generation.
 */

import { db, calculateHaversineDistanceKm } from '../db/database.js';
import { routingService } from '../routing/routing.service.js';
import { 
  EmergencyCall, 
  CallSeverity, 
  DispatchJob, 
  JobStatus, 
  RankedAmbulance, 
  HospitalSuggestion,
  EquipmentLevel 
} from '../../src/types/index.js';
import { ioEmitter } from '../socket/socket.handler.js';

export class DispatchService {
  /**
   * 1. Create emergency call
   */
  public static createCall(params: {
    caller_info: string;
    caller_phone: string;
    chief_complaint: string;
    lat: number;
    lng: number;
    address: string;
    severity: CallSeverity;
    patient_notes?: string;
  }): EmergencyCall {
    const call: EmergencyCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      caller_info: params.caller_info,
      caller_phone: params.caller_phone,
      chief_complaint: params.chief_complaint,
      lat: params.lat,
      lng: params.lng,
      address: params.address,
      severity: params.severity,
      status: 'Pending',
      patient_notes: params.patient_notes,
      created_at: new Date().toISOString()
    };

    db.emergencyCalls.set(call.id, call);
    ioEmitter.emitToRole('dispatcher', 'call:created', call);
    return call;
  }

  /**
   * 2. Geospatially pre-filter available ambulances with PostGIS,
   * then query RoutingService for real road ETA, and rank by ETA + severity weighting.
   */
  public static async getRankedAmbulancesForCall(callId: string): Promise<RankedAmbulance[]> {
    const call = db.emergencyCalls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    // Step 1: Geospatial pre-filter (PostGIS radius search - max 12 nearest candidates within 30km)
    const candidates = db.queryAvailableAmbulancesWithinRadius(call.lat, call.lng, 30, 12);
    if (candidates.length === 0) {
      return [];
    }

    // Step 2: Query RoutingService Distance Matrix for real travel ETA
    const origins = candidates.map(c => ({ lat: c.ambulance.current_lat, lng: c.ambulance.current_lng }));
    const destinations = [{ lat: call.lat, lng: call.lng }];

    const matrix = await routingService.getDistanceMatrix(origins, destinations);

    // Step 3: Compute Severity-Weighted Assignment Scoring
    const rankedList: RankedAmbulance[] = candidates.map((candidate, idx) => {
      const amb = candidate.ambulance;
      const matrixElem = matrix.elements.find(e => e.originIndex === idx && e.destinationIndex === 0);
      
      const etaSeconds = matrixElem ? matrixElem.durationSeconds : Math.max(60, Math.round((candidate.distanceKm * 1.35 / 38) * 3600));
      const distanceMeters = matrixElem ? matrixElem.distanceMeters : Math.round(candidate.distanceKm * 1000);

      // Scoring Model:
      // A. Proximity Score (0-55 pts): lower ETA = higher score (0 sec = 55, 1200 sec = 5)
      const proximityScore = Math.max(5, Math.round(55 * Math.max(0, (1 - etaSeconds / 1500))));

      // B. Equipment Match Score (0-35 pts) based on call severity
      let equipmentScore = 15;
      let equipmentMatch = true;

      if (call.severity === 'Level 1 - Resuscitation') {
        if (amb.equipment_level === 'Critical Care') {
          equipmentScore = 35;
        } else if (amb.equipment_level === 'Advanced') {
          equipmentScore = 24;
        } else {
          equipmentScore = 8;
          equipmentMatch = false; // Basic unit is sub-optimal for Level 1 Resuscitation
        }
      } else if (call.severity === 'Level 2 - Emergent') {
        if (amb.equipment_level === 'Critical Care' || amb.equipment_level === 'Advanced') {
          equipmentScore = 30;
        } else {
          equipmentScore = 15;
        }
      } else {
        // Level 3, 4, 5
        if (amb.equipment_level === 'Basic') {
          equipmentScore = 30; // Conserve Advanced/Critical for high severity
        } else {
          equipmentScore = 22;
        }
      }

      // C. Driver readiness bonus
      const availabilityScore = 10;
      const totalScore = Math.min(100, Math.max(1, proximityScore + equipmentScore + availabilityScore));

      const mins = Math.floor(etaSeconds / 60);
      const secs = etaSeconds % 60;
      const etaFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      return {
        ambulance: amb,
        distance_km: Number((distanceMeters / 1000).toFixed(2)),
        eta_seconds: etaSeconds,
        eta_formatted: etaFormatted,
        match_score: totalScore,
        equipment_match: equipmentMatch,
        score_breakdown: {
          proximity_score: proximityScore,
          equipment_score: equipmentScore,
          availability_score: availabilityScore
        }
      };
    });

    // Rank primarily by match_score (descending), then by eta_seconds (ascending)
    rankedList.sort((a, b) => b.match_score - a.match_score || a.eta_seconds - b.eta_seconds);
    return rankedList;
  }

  /**
   * 3. Hospital Suggestion Engine
   * Evaluates proximity, capacity, and matching trauma/specialty capabilities
   */
  public static async suggestHospitalsForCall(callId: string): Promise<HospitalSuggestion[]> {
    const call = db.emergencyCalls.get(callId);
    if (!call) throw new Error(`Call ${callId} not found`);

    const hospitals = Array.from(db.hospitals.values());
    const origins = [{ lat: call.lat, lng: call.lng }];
    const destinations = hospitals.map(h => ({ lat: h.lat, lng: h.lng }));

    const matrix = await routingService.getDistanceMatrix(origins, destinations);

    const suggestions: HospitalSuggestion[] = hospitals.map((hosp, idx) => {
      const matrixElem = matrix.elements.find(e => e.originIndex === 0 && e.destinationIndex === idx);
      const etaSeconds = matrixElem ? matrixElem.durationSeconds : Math.round((calculateHaversineDistanceKm(call.lat, call.lng, hosp.lat, hosp.lng) * 1.35 / 40) * 3600);
      const distKm = calculateHaversineDistanceKm(call.lat, call.lng, hosp.lat, hosp.lng);

      const matchReasons: string[] = [];
      let isRecommended = true;

      // Specialty evaluation
      const complaintLower = call.chief_complaint.toLowerCase();
      if (complaintLower.includes('trauma') || complaintLower.includes('collision') || complaintLower.includes('fall')) {
        if (hosp.specialties.includes('Level I Trauma') || hosp.trauma_level === 'Level I') {
          matchReasons.push('Designated Level I Comprehensive Trauma Center');
        }
      }
      if (complaintLower.includes('stemi') || complaintLower.includes('chest pain') || complaintLower.includes('cardiac')) {
        if (hosp.specialties.includes('Cardiology & STEMI') || hosp.specialties.includes('Emergency Resuscitation')) {
          matchReasons.push('Direct Cath Lab / STEMI Alert Receiving Facility');
        }
      }
      if (complaintLower.includes('stroke')) {
        if (hosp.specialties.some(s => s.includes('Stroke'))) {
          matchReasons.push('Designated Stroke Receiving Center');
        }
      }

      // Capacity penalty
      if (hosp.capacity_status === 'Diverted') {
        isRecommended = false;
        matchReasons.push('Warning: Facility currently on Divert Status');
      } else if (hosp.capacity_status === 'Full' || hosp.available_beds <= 0) {
        isRecommended = false;
        matchReasons.push('Warning: Emergency intake beds at maximum capacity');
      } else {
        matchReasons.push(`${hosp.available_beds} intake beds ready (${hosp.capacity_status} load)`);
      }

      const mins = Math.floor(etaSeconds / 60);
      const secs = etaSeconds % 60;
      const etaFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      return {
        hospital: hosp,
        distance_km: distKm,
        eta_seconds: etaSeconds,
        eta_formatted: etaFormatted,
        is_recommended: isRecommended && (hosp.capacity_status === 'Normal' || hosp.capacity_status === 'High'),
        match_reasons: matchReasons
      };
    });

    suggestions.sort((a, b) => {
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;
      return a.eta_seconds - b.eta_seconds;
    });

    return suggestions;
  }

  /**
   * 4. Assign Job and compute full turn-by-turn route
   */
  public static async assignJob(callId: string, ambulanceId: string, hospitalId: string): Promise<DispatchJob> {
    const call = db.emergencyCalls.get(callId);
    if (!call) throw new Error(`Call ${callId} not found`);

    const ambulance = db.ambulances.get(ambulanceId);
    if (!ambulance) throw new Error(`Ambulance ${ambulanceId} not found`);

    const hospital = db.hospitals.get(hospitalId);
    if (!hospital) throw new Error(`Hospital ${hospitalId} not found`);

    // Compute route from ambulance's current location to incident scene
    const route = await routingService.getRoute(
      { lat: ambulance.current_lat, lng: ambulance.current_lng },
      { lat: call.lat, lng: call.lng }
    );

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const job: DispatchJob = {
      id: jobId,
      call_id: callId,
      ambulance_id: ambulanceId,
      hospital_id: hospitalId,
      status: 'Assigned',
      assigned_at: new Date().toISOString(),
      eta_seconds: route.durationSeconds,
      distance_meters: route.distanceMeters,
      route_polyline: route.polyline,
      coordinates: route.coordinates,
      turn_by_turn_steps: route.steps,
      completed_at: null,
      call,
      ambulance,
      hospital
    };

    // Update DB state
    db.dispatchJobs.set(job.id, job);
    call.status = 'Dispatched';
    ambulance.status = 'Assigned';
    ambulance.updated_at = new Date().toISOString();

    // Mandatory Audit Trail Event
    const event = db.recordStatusEvent(
      job.id,
      'ASSIGNED',
      `Assigned unit ${ambulance.call_sign} to incident #${call.id}. Destination hospital: ${hospital.name}`,
      ambulance.current_lat,
      ambulance.current_lng
    );

    // Push over WebSocket
    ioEmitter.emitToAmbulance(ambulanceId, 'job:assigned', job);
    ioEmitter.emitToRole('dispatcher', 'job:created', job);
    ioEmitter.emitToRole('hospital', 'hospital:incoming_alert', { job, hospital });
    ioEmitter.emitToRole('dispatcher', 'status:event', event);

    return job;
  }

  /**
   * 5. Update Job Status with Mandatory Audit Trail and Route Re-computation if transitioning to hospital
   */
  public static async updateJobStatus(jobId: string, newStatus: JobStatus, notes?: string, currentLat?: number, currentLng?: number): Promise<DispatchJob> {
    const job = db.dispatchJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const prevStatus = job.status;
    job.status = newStatus;

    const ambulance = db.ambulances.get(job.ambulance_id);
    const call = db.emergencyCalls.get(job.call_id);
    const hospital = db.hospitals.get(job.hospital_id);

    // Update location if provided
    if (currentLat !== undefined && currentLng !== undefined && ambulance) {
      ambulance.current_lat = currentLat;
      ambulance.current_lng = currentLng;
      ambulance.updated_at = new Date().toISOString();
    }

    // Status sync
    if (ambulance) {
      if (newStatus === 'Completed' || newStatus === 'Cancelled') {
        ambulance.status = 'Available';
      } else {
        ambulance.status = newStatus as any;
      }
      ambulance.updated_at = new Date().toISOString();
    }

    if (call) {
      if (newStatus === 'Completed') {
        call.status = 'Resolved';
      } else if (newStatus === 'Cancelled') {
        call.status = 'Cancelled';
      } else {
        call.status = 'Active';
      }
    }

    if (newStatus === 'Completed') {
      job.completed_at = new Date().toISOString();
    }

    // If transitioning to 'Transporting', calculate route from scene to hospital!
    if (newStatus === 'Transporting' && hospital && ambulance) {
      try {
        const hospitalRoute = await routingService.getRoute(
          { lat: ambulance.current_lat, lng: ambulance.current_lng },
          { lat: hospital.lat, lng: hospital.lng }
        );
        job.route_polyline = hospitalRoute.polyline;
        job.coordinates = hospitalRoute.coordinates;
        job.turn_by_turn_steps = hospitalRoute.steps;
        job.eta_seconds = hospitalRoute.durationSeconds;
        job.distance_meters = hospitalRoute.distanceMeters;
      } catch (err: any) {
        console.warn('Error calculating hospital route:', err.message);
      }
    }

    // Mandatory Audit Trail Event
    const event = db.recordStatusEvent(
      job.id,
      newStatus,
      notes || `Status progressed from ${prevStatus} to ${newStatus}`,
      currentLat ?? ambulance?.current_lat,
      currentLng ?? ambulance?.current_lng
    );

    // Broadcast updates
    ioEmitter.emitToAll('job:updated', { job, event });
    ioEmitter.emitToAmbulance(job.ambulance_id, 'job:updated', { job, event });
    ioEmitter.emitToHospital(job.hospital_id, 'hospital:job_updated', { job, event });
    ioEmitter.emitToRole('dispatcher', 'status:event', event);

    return job;
  }
}
