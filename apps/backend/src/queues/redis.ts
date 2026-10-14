import { Redis } from 'ioredis';
import { env } from '../config/env.js';
export const redisConnection = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, password: env.REDIS_PASSWORD || undefined, maxRetriesPerRequest: null, lazyConnect: env.NODE_ENV === 'test', retryStrategy: env.NODE_ENV === 'test' ? () => null : undefined });
redisConnection.on('error', () => undefined);
export const newRedisConnection = () => { const connection = redisConnection.duplicate(); connection.on('error', () => undefined); return connection; };
