/**
 * Express API Router
 * Modular endpoint definitions for Auth, Fleet, Hospitals, Dispatch, Routing, and Audit Events.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { AuthService, AuthenticatedRequest } from '../auth/auth.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { FleetService } from '../services/fleet.service.js';
import { HospitalService } from '../services/hospital.service.js';
import { UserRole, AmbulanceStatus, HospitalCapacityStatus, JobStatus } from '../../src/types/index.js';

export const apiRouter = Router();

// ==========================================
// 1. Auth Endpoints
// ==========================================

apiRouter.get('/auth/users', (req: Request, res: Response) => {
  const users = Array.from(db.users.values());
  res.json({ users });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, userId } = req.body;
  let user = userId ? db.users.get(userId) : Array.from(db.users.values()).find(u => u.username === username);

  if (!user) {
    // If not found, default to dispatcher or create demo user
    user = Array.from(db.users.values())[0];
  }

  const token = AuthService.generateToken(user);
  res.json({ token, user });
});

apiRouter.get('/auth/me', AuthService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user ? db.users.get(req.user.userId) : null;
  res.json({ user });
});

// ==========================================
// 2. Fleet & Ambulances
// ==========================================

apiRouter.get('/fleet/ambulances', (req: Request, res: Response) => {
  const ambulances = FleetService.getAllAmbulances();
  res.json({ ambulances });
});

apiRouter.post('/fleet/ambulances', (req: Request, res: Response) => {
  const amb = FleetService.createAmbulance(req.body);
  res.status(201).json({ ambulance: amb });
});

apiRouter.patch('/fleet/ambulances/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const amb = FleetService.updateAmbulanceStatus(req.params.id, status as AmbulanceStatus);
    res.json({ ambulance: amb });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/fleet/drivers', (req: Request, res: Response) => {
  const drivers = FleetService.getAllDrivers();
  res.json({ drivers });
});

// ==========================================
// 3. Hospitals Registry & Intake
// ==========================================

apiRouter.get('/hospitals', (req: Request, res: Response) => {
  const hospitals = HospitalService.getAllHospitals();
  res.json({ hospitals });
});

apiRouter.patch('/hospitals/:id/capacity', (req: Request, res: Response) => {
  try {
    const { capacity_status, available_beds } = req.body;
    const hospital = HospitalService.updateCapacity(
      req.params.id,
      capacity_status as HospitalCapacityStatus,
      available_beds
    );
    res.json({ hospital });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/hospitals/:id/intake-queue', (req: Request, res: Response) => {
  try {
    const queue = HospitalService.getIntakeQueue(req.params.id);
    res.json({ queue });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/hospitals/:id/intake-queue/:jobId/acknowledge', (req: Request, res: Response) => {
  try {
    const { bedAssignment } = req.body;
    const job = HospitalService.acknowledgePatientIntake(req.params.id, req.params.jobId, bedAssignment);
    res.json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 4. Emergency Calls & Pre-filter / ETA Ranking
// ==========================================

apiRouter.get('/dispatch/calls', (req: Request, res: Response) => {
  const calls = Array.from(db.emergencyCalls.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json({ calls });
});

apiRouter.post('/dispatch/calls', (req: Request, res: Response) => {
  try {
    const call = DispatchService.createCall(req.body);
    res.status(201).json({ call });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PostGIS Pre-filter + Routing API real ETA ranking
apiRouter.get('/dispatch/calls/:id/ranked-ambulances', async (req: Request, res: Response) => {
  try {
    const ranked = await DispatchService.getRankedAmbulancesForCall(req.params.id);
    res.json({ ranked });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Hospital suggestions for call
apiRouter.get('/dispatch/calls/:id/suggested-hospitals', async (req: Request, res: Response) => {
  try {
    const suggestions = await DispatchService.suggestHospitalsForCall(req.params.id);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. Job Assignment & Status Progression
// ==========================================

apiRouter.post('/dispatch/assign', async (req: Request, res: Response) => {
  try {
    const { call_id, ambulance_id, hospital_id } = req.body;
    if (!call_id || !ambulance_id || !hospital_id) {
      return res.status(400).json({ error: 'call_id, ambulance_id, and hospital_id are required' });
    }
    const job = await DispatchService.assignJob(call_id, ambulance_id, hospital_id);
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/dispatch/jobs', (req: Request, res: Response) => {
  const jobs = Array.from(db.dispatchJobs.values()).map(job => ({
    ...job,
    ambulance: db.ambulances.get(job.ambulance_id),
    call: db.emergencyCalls.get(job.call_id),
    hospital: db.hospitals.get(job.hospital_id)
  }));
  res.json({ jobs });
});

apiRouter.get('/dispatch/jobs/:id', (req: Request, res: Response) => {
  const job = db.dispatchJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    job: {
      ...job,
      ambulance: db.ambulances.get(job.ambulance_id),
      call: db.emergencyCalls.get(job.call_id),
      hospital: db.hospitals.get(job.hospital_id)
    }
  });
});

apiRouter.patch('/dispatch/jobs/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, notes, currentLat, currentLng } = req.body;
    const job = await DispatchService.updateJobStatus(
      req.params.id,
      status as JobStatus,
      notes,
      currentLat,
      currentLng
    );
    res.json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Audit Trail Events
apiRouter.get('/dispatch/events', (req: Request, res: Response) => {
  res.json({ events: db.statusEvents.slice(0, 50) });
});

// ==========================================
// 6. Driver Specific Endpoints
// ==========================================

apiRouter.get('/driver/active-job/:ambulanceId', (req: Request, res: Response) => {
  const ambulanceId = req.params.ambulanceId;
  let activeJob: any = null;

  for (const job of db.dispatchJobs.values()) {
    if (job.ambulance_id === ambulanceId && job.status !== 'Completed' && job.status !== 'Cancelled') {
      activeJob = {
        ...job,
        ambulance: db.ambulances.get(job.ambulance_id),
        call: db.emergencyCalls.get(job.call_id),
        hospital: db.hospitals.get(job.hospital_id)
      };
      break;
    }
  }

  res.json({ activeJob });
});

apiRouter.post('/driver/location', async (req: Request, res: Response) => {
  try {
    await FleetService.processDriverLocation(req.body);
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 7. System Ops & Telemetry
// ==========================================

apiRouter.post('/system/seed', (req: Request, res: Response) => {
  db.seedInitialData();
  res.json({ status: 'seeded', message: 'System database reset with demo ambulances, hospitals, and calls.' });
});

apiRouter.get('/system/stats', (req: Request, res: Response) => {
  const ambulances = Array.from(db.ambulances.values());
  const availableAmbulances = ambulances.filter(a => a.status === 'Available').length;
  const hospitals = Array.from(db.hospitals.values());
  const totalBeds = hospitals.reduce((acc, h) => acc + h.total_beds, 0);
  const availableBeds = hospitals.reduce((acc, h) => acc + h.available_beds, 0);
  const activeJobs = Array.from(db.dispatchJobs.values()).filter(j => j.status !== 'Completed' && j.status !== 'Cancelled').length;
  const pendingCalls = Array.from(db.emergencyCalls.values()).filter(c => c.status === 'Pending').length;

  res.json({
    availableAmbulances,
    totalAmbulances: ambulances.length,
    activeJobs,
    pendingCalls,
    availableBeds,
    totalBeds,
    hospitalsCount: hospitals.length
  });
});
