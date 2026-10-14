import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { redisConnection } from './redis.js';
export type EmailJob = { emailId: string };
export const emailQueue = new Queue<EmailJob>(env.QUEUE_NAME, { connection: redisConnection, defaultJobOptions: { attempts: 4, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } } });
export const stableJobId = (emailId: string) => `email:${emailId}`;
export async function enqueueEmail(emailId: string, scheduledTime: Date) { return emailQueue.add('send-email', { emailId }, { jobId: stableJobId(emailId), delay: Math.max(0, scheduledTime.getTime() - Date.now()) }); }
