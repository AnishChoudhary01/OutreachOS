import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { scheduleEmails } from '../services/scheduling.js';

export const scheduleSchema = z.object({ senderId: z.string().min(1), recipients: z.array(z.email()).min(1).max(10000), subject: z.string().trim().min(1).max(998), body: z.string().min(1).max(100000), startTime: z.coerce.date(), delayBetweenEmailsMs: z.number().int().min(0).max(86400000), maxEmailsPerHour: z.number().int().positive().max(100000), idempotencyKey: z.string().trim().min(8).max(200) });
const pagination = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(25) });
export const emailRouter = Router();
emailRouter.post('/schedule', async (req, res, next) => { try { const input = scheduleSchema.parse(req.body); if (input.startTime.getTime() <= Date.now()) return res.status(400).json({ error: 'startTime must be in the future' }); const effectiveLimit = Math.min(input.maxEmailsPerHour, env.MAX_EMAILS_PER_HOUR_PER_SENDER); const result = await scheduleEmails({ ...input, maxEmailsPerHour: effectiveLimit }); return res.status(201).json({ scheduleId: result.id, emailIds: result.emails.map((e) => e.id), scheduledTimes: result.emails.map((e) => e.scheduledTime), idempotent: result.idempotencyKey === input.idempotencyKey }); } catch (e) { next(e); } });
async function list(status: 'scheduled' | 'sent', req: any, res: any, next: any) { try { const p = pagination.parse(req.query); const where = { status }; const [items, total] = await prisma.$transaction([prisma.email.findMany({ where, orderBy: { scheduledTime: 'asc' }, skip: (p.page - 1) * p.limit, take: p.limit, include: { sender: true } }), prisma.email.count({ where })]); return res.json({ items, page: p.page, limit: p.limit, total }); } catch (e) { next(e); } }
emailRouter.get('/scheduled', (req, res, next) => list('scheduled', req, res, next)); emailRouter.get('/sent', (req, res, next) => list('sent', req, res, next));
emailRouter.get('/:id', async (req, res, next) => { try { const item = await prisma.email.findUnique({ where: { id: req.params.id }, include: { sender: true, schedule: true } }); if (!item) return res.status(404).json({ error: 'Email not found' }); return res.json(item); } catch (e) { next(e); } });
