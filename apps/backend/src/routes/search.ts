import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { reindexOwner, searchEmails } from '../services/search.js';
const router = Router(); const params = z.object({ q: z.string().max(200).default(''), status: z.enum(['scheduled', 'processing', 'sent', 'failed']).optional(), page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(25) });
router.use(requireAuth);
router.get('/emails', async (req, res, next) => { try { const p = params.parse(req.query); const result = await searchEmails(req.user!.id, p.q, p.status, p.page, p.limit); if (!result) return res.status(503).json({ error: 'Search service unavailable; PostgreSQL remains authoritative' }); return res.json({ ...result, page: p.page, limit: p.limit }); } catch (e) { next(e); } });
router.post('/emails/reindex', async (req, res, next) => { try { const result = await reindexOwner(req.user!.id); return res.json(result); } catch (e) { next(e); } });
export { router as searchRouter };
