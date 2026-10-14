import express from 'express';
import { emailRouter } from './routes/emails.js';
export const app = express(); app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'outreachos-api' })); app.use('/api/emails', emailRouter);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { if (err?.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.issues }); const status = err?.statusCode || 500; return res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message }); });
