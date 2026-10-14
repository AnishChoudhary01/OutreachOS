import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router(); router.use(requireAuth);
router.get('/', async (req, res, next) => { try { const senders = await prisma.sender.findMany({ where: { ownerId: req.user!.id, active: true }, select: { id: true, name: true, email: true }, orderBy: { email: 'asc' } }); return res.json({ senders }); } catch (e) { next(e); } });
export { router as senderRouter };
