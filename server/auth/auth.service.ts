/**
 * Authentication and Role-Based Access Service
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserProfile, UserRole } from '../../src/types/index.js';
import { db } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-ambulance-routing';

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  ambulance_id?: string;
  hospital_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export class AuthService {
  public static generateToken(user: UserProfile): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      ambulance_id: user.ambulance_id,
      hospital_id: user.hospital_id
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  public static verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  public static requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = AuthService.verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }

    req.user = payload;
    next();
  }

  public static requireRoles(allowedRoles: UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: `Forbidden: requires one of roles [${allowedRoles.join(', ')}]` });
      }
      next();
    };
  }
}
