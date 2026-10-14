import { newRedisConnection } from '../queues/redis.js';

const script = `local now=tonumber(ARGV[1]); local minDelay=tonumber(ARGV[2]); local hour=tonumber(ARGV[3]); local limit=tonumber(ARGV[4]); redis.call('ZREMRANGEBYSCORE',KEYS[1],0,now-hour); local latest=redis.call('ZREVRANGEBYSCORE',KEYS[1],now,0,'WITHSCORES','LIMIT',0,1); if #latest>0 and now-tonumber(latest[2])<minDelay then return {0,tonumber(latest[2])+minDelay} end; if redis.call('ZCARD',KEYS[1])>=limit then local oldest=redis.call('ZRANGE',KEYS[1],0,0,'WITHSCORES'); return {0,tonumber(oldest[2])+hour} end; local member=tostring(now)..'-'..redis.call('INCR','outreachos:rate-seq'); redis.call('ZADD',KEYS[1],now,member); redis.call('EXPIRE',KEYS[1],hour/1000+60); return {1,now}`;
export type RateDecision = { allowed: boolean; retryAt: number };
export async function reserveSend(senderId: string, minDelayMs: number, hourlyLimit: number): Promise<RateDecision> {
  const redis = newRedisConnection();
  try { const now = Date.now(); const result = await redis.eval(script, 1, `outreachos:sender-rate:${senderId}`, now, minDelayMs, 3600000, hourlyLimit) as [number, number]; return { allowed: result[0] === 1, retryAt: result[1] }; }
  finally { await redis.quit(); }
}
