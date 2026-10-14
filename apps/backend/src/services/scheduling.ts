import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { enqueueEmail } from '../queues/emailQueue.js';

export function executionTimes(startTime: Date, delayMs: number, count: number) { return Array.from({ length: count }, (_, i) => new Date(startTime.getTime() + i * delayMs)); }
export function normalizeRecipients(recipients: string[]) { return [...new Set(recipients.map((r) => r.trim().toLowerCase()))]; }
export async function scheduleEmails(input: { ownerId: string; senderId: string; recipients: string[]; subject: string; body: string; startTime: Date; delayBetweenEmailsMs: number; maxEmailsPerHour: number; idempotencyKey: string }) {
  const sender = await prisma.sender.findFirst({ where: { id: input.senderId, ownerId: input.ownerId, active: true } }); if (!sender) throw Object.assign(new Error('Sender not found or inactive'), { statusCode: 404 });
  const recipients = normalizeRecipients(input.recipients);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.schedule.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { emails: true } }); if (existing) { if (existing.ownerId !== input.ownerId) throw Object.assign(new Error('Idempotency key belongs to another user'), { statusCode: 409 }); return existing; }
      const schedule = await tx.schedule.create({ data: { ownerId: input.ownerId, senderId: input.senderId, idempotencyKey: input.idempotencyKey, delayBetweenEmailsMs: input.delayBetweenEmailsMs, maxEmailsPerHour: input.maxEmailsPerHour, startTime: input.startTime } });
      const times = executionTimes(input.startTime, input.delayBetweenEmailsMs, recipients.length);
      const emails = recipients.map((recipientEmail, i) => { const id = randomUUID(); return { id, ownerId: input.ownerId, scheduleId: schedule.id, senderId: input.senderId, recipientEmail, subject: input.subject, body: input.body, scheduledTime: times[i], bullmqJobId: `email:${id}` }; });
      await tx.email.createMany({ data: emails }); await tx.emailIndexOutbox.createMany({ data: emails.map((email) => ({ userId: input.ownerId, emailId: email.id })) });
      return tx.schedule.findUniqueOrThrow({ where: { id: schedule.id }, include: { emails: true } });
    });
    for (const email of result.emails) await enqueueEmail(email.id, email.scheduledTime);
    return result;
  } catch (error: unknown) { if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') { const existing = await prisma.schedule.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { emails: true } }); if (existing && existing.ownerId === input.ownerId) return existing; } throw error; }
}
