/**
 * Real-time WebSocket Client (Socket.IO)
 */

import { io, Socket } from 'socket.io-client';
import { getApiAuthToken } from './api.js';
import { DriverLocationPayload, JobStatus } from '../types/index.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Ambulance Intelligence Routing WebSocket');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket');
    });
  }
  return socket;
}

export function registerSocketClient(role: string, ambulanceId?: string, hospitalId?: string) {
  const s = getSocket();
  const token = getApiAuthToken();
  s.emit('client:register', { token, role, ambulanceId, hospitalId });
}

export function sendDriverLocation(payload: DriverLocationPayload) {
  const s = getSocket();
  s.emit('driver:location_update', payload);
}

export function sendDriverStatusUpdate(data: {
  jobId: string;
  newStatus: JobStatus;
  notes?: string;
  currentLat?: number;
  currentLng?: number;
}) {
  const s = getSocket();
  s.emit('driver:update_job_status', data);
}
