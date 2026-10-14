import { prisma } from './db.js'; import { startWorker } from './workers/emailWorker.js';
const worker = await startWorker(); console.log('Email worker started');
async function shutdown() { await worker.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
