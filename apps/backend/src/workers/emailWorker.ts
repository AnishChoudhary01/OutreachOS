import { DelayedError, Job, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../db.js';
import { emailQueue, EmailJob } from '../queues/emailQueue.js';
import { redisConnection } from '../queues/redis.js';
import { reserveSend } from '../services/rateLimiter.js';
import { sendEmail } from '../services/mailer.js';
import { indexEmail, processIndexOutbox } from '../services/search.js';
import { notifyRateLimit } from '../services/slack.js';

export function isTransient(error: unknown) { const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase(); return /timeout|temporar|rate|eai_again|connection|network|smtp 4\d\d/.test(message); }

async function processJob(job: Job<EmailJob>) {
  const email = await prisma.email.findUnique({ where: { id: job.data.emailId }, include: { sender: true, schedule: true } });
  if (!email || email.status === 'sent') return;
  const now = Date.now(); if (email.scheduledTime.getTime() > now) { await job.moveToDelayed(email.scheduledTime.getTime(), job.token); throw new DelayedError(); }
  const decision = await reserveSend(email.senderId, Math.max(env.MIN_DELAY_BETWEEN_EMAILS_MS, email.schedule.delayBetweenEmailsMs), Math.min(email.schedule.maxEmailsPerHour, env.MAX_EMAILS_PER_HOUR_PER_SENDER));
  if (!decision.allowed) { await notifyRateLimit(email.ownerId, email.sender.email, decision.retryAt); await job.moveToDelayed(Math.max(decision.retryAt, Date.now() + 1000), job.token); throw new DelayedError(); }
  const claimed = await prisma.email.updateMany({ where: { id: email.id, status: 'scheduled' }, data: { status: 'processing', attemptCount: { increment: 1 } } });
  if (claimed.count === 0) return;
  try { const result = await sendEmail({ from: `${email.sender.name} <${email.sender.email}>`, to: email.recipientEmail, subject: email.subject, text: email.body }); const updated = await prisma.email.update({ where: { id: email.id }, data: { status: 'sent', sentTime: new Date(), messageId: result.messageId, previewUrl: result.previewUrl, lastError: null }, include: { sender: true } }); if (!(await indexEmail(updated))) await prisma.emailIndexOutbox.create({ data: { userId: updated.ownerId, emailId: updated.id } }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unknown SMTP error'; const transient = isTransient(error); const updated = await prisma.email.update({ where: { id: email.id }, data: { status: transient ? 'scheduled' : 'failed', lastError: message }, include: { sender: true } }); if (!(await indexEmail(updated))) await prisma.emailIndexOutbox.create({ data: { userId: updated.ownerId, emailId: updated.id } }); if (transient) throw error; }
}

export async function reconcilePendingJobs() {
  // A processing row means a worker claimed it. After a crash, SMTP may have
  // accepted it already, so never automatically resend this uncertain outcome.
  await prisma.email.updateMany({ where: { status: 'processing' }, data: { status: 'failed', lastError: 'Uncertain SMTP outcome after worker restart; manual review required.' } });
  const pending = await prisma.email.findMany({ where: { status: 'scheduled' }, take: env.RECONCILIATION_BATCH_SIZE, select: { id: true, scheduledTime: true } });
  for (const email of pending) await emailQueue.add('send-email', { emailId: email.id }, { jobId: `email:${email.id}`, delay: Math.max(0, email.scheduledTime.getTime() - Date.now()) });
  return pending.length;
}
export async function startWorker() { await reconcilePendingJobs(); await processIndexOutbox(); const worker = new Worker<EmailJob>(env.QUEUE_NAME, processJob, { connection: redisConnection, concurrency: env.WORKER_CONCURRENCY }); worker.on('failed', async (job, error) => { if (!job || error instanceof DelayedError) return; if (job.attemptsMade >= (job.opts.attempts ?? 1)) await prisma.email.updateMany({ where: { id: job.data.emailId, status: { not: 'sent' } }, data: { status: 'failed', lastError: error.message } }); }); return worker; }
