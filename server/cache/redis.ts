/**
 * Redis-compatible In-Memory Cache and PubSub Layer
 * Provides short-TTL route caching, live location cache, and event pub-sub.
 */

import { EventEmitter } from 'events';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class RedisCache extends EventEmitter {
  private static instance: RedisCache;
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupTimer: NodeJS.Timeout;

  private constructor() {
    super();
    // Auto purge expired entries every 30 seconds
    this.cleanupTimer = setInterval(() => this.purgeExpired(), 30000);
  }

  public static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    this.store.set(key, { value, expiresAt });
  }

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const now = Date.now();
    const result: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.expiresAt && regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  public async setLocation(ambulanceId: string, data: { lat: number; lng: number; speed?: number; heading?: number }): Promise<void> {
    // 30-second TTL for live location
    await this.set(`location:ambulance:${ambulanceId}`, { ...data, updatedAt: Date.now() }, 30);
    this.emit(`location:${ambulanceId}`, data);
    this.emit('location:any', { ambulanceId, ...data });
  }

  public async getLocation(ambulanceId: string): Promise<{ lat: number; lng: number; speed?: number; heading?: number; updatedAt: number } | null> {
    return this.get(`location:ambulance:${ambulanceId}`);
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  public destroy() {
    clearInterval(this.cleanupTimer);
  }
}

export const redis = RedisCache.getInstance();
