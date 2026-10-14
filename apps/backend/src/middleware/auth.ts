import { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { hashToken } from '../services/crypto.js';

export async function loadSession(req: Request, _res: Response, next: NextFunction) { try { const raw = req.headers.cookie?.split(';').map((x) => x.trim()).find((x) => x.startsWith('outreachos_session='))?.split('=')[1]; if (!raw) return next(); const session = await prisma.session.findFirst({ where: { tokenHash: hashToken(raw), expiresAt: { gt: new Date() } }, include: { user: true } }); if (session) { req.user = session.user; req.sessionId = session.id; } return next(); } catch (error) { return next(error); } }
export function requireAuth(req: Request, res: Response, next: NextFunction) { if (!req.user) return res.status(401).json({ error: 'Authentication required' }); return next(); }
export function requireAdmin(req: Request, res: Response, next: NextFunction) { const admins = env.BULL_BOARD_ADMIN_EMAILS.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); if (!req.user || !admins.includes(req.user.email.toLowerCase())) return res.status(403).json({ error: 'Administrator access required' }); return next(); }
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) { if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next(); const origin = req.headers.origin; if (origin && origin !== env.FRONTEND_ORIGIN) return res.status(403).json({ error: 'Origin rejected' }); return next(); }
