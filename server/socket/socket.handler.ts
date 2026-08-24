/**
 * WebSocket and Realtime Communication Layer (Socket.IO)
 * Handles driver location streaming, job dispatch notifications,
 * status transitions, and role-based room subscriptions.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { FleetService } from '../services/fleet.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { AuthService } from '../auth/auth.service.js';
import { DriverLocationPayload, JobStatus } from '../../src/types/index.js';

class SocketEmitter {
  private io: SocketIOServer | null = null;

  public setIO(io: SocketIOServer) {
    this.io = io;
  }

  public emitToAll(event: string, data: any) {
    this.io?.emit(event, data);
  }

  public emitToRole(role: string, event: string, data: any) {
    this.io?.to(`role:${role}`).emit(event, data);
  }

  public emitToAmbulance(ambulanceId: string, event: string, data: any) {
    this.io?.to(`ambulance:${ambulanceId}`).emit(event, data);
  }

  public emitToHospital(hospitalId: string, event: string, data: any) {
    this.io?.to(`hospital:${hospitalId}`).emit(event, data);
  }
}

export const ioEmitter = new SocketEmitter();

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioEmitter.setIO(io);

  io.on('connection', (socket: Socket) => {
    // 1. Join room based on client registration/auth
    socket.on('client:register', (data: { token?: string; role?: string; ambulanceId?: string; hospitalId?: string }) => {
      let role = data.role || 'dispatcher';
      let ambulanceId = data.ambulanceId;
      let hospitalId = data.hospitalId;

      if (data.token) {
        const payload = AuthService.verifyToken(data.token);
        if (payload) {
          role = payload.role;
          ambulanceId = payload.ambulance_id || ambulanceId;
          hospitalId = payload.hospital_id || hospitalId;
        }
      }

      socket.join(`role:${role}`);
      if (ambulanceId) {
        socket.join(`ambulance:${ambulanceId}`);
      }
      if (hospitalId) {
        socket.join(`hospital:${hospitalId}`);
      }

      socket.emit('registered', { status: 'ok', role, ambulanceId, hospitalId });
    });

    // 2. Driver live GPS telemetry streaming (every 5-10s)
    socket.on('driver:location_update', async (payload: DriverLocationPayload) => {
      try {
        await FleetService.processDriverLocation(payload);
      } catch (err: any) {
        console.error('Error handling driver location update:', err.message);
      }
    });

    // 3. Driver job status progression
    socket.on('driver:update_job_status', async (data: {
      jobId: string;
      newStatus: JobStatus;
      notes?: string;
      currentLat?: number;
      currentLng?: number;
    }) => {
      try {
        const updated = await DispatchService.updateJobStatus(
          data.jobId,
          data.newStatus,
          data.notes,
          data.currentLat,
          data.currentLng
        );
        socket.emit('job:status_updated_ack', { status: 'success', job: updated });
      } catch (err: any) {
        socket.emit('job:status_updated_ack', { status: 'error', message: err.message });
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
}
