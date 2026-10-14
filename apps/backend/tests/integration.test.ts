import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';
describe.skipIf(!enabled)('Phase 1 PostgreSQL/Redis integration', () => {
  let prisma: any;
  let redisConnection: any;
  let emailQueue: any;
  beforeAll(async () => {
    ({ prisma } = await import('../src/db.js'));
    ({ redisConnection } = await import('../src/queues/redis.js'));
    ({ emailQueue } = await import('../src/queues/emailQueue.js'));
  });
  afterAll(async () => { await emailQueue.close(); await redisConnection.quit(); await prisma.$disconnect(); });

  it('connects to PostgreSQL and Redis', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined();
    await expect(redisConnection.ping()).resolves.toBe('PONG');
  });

  it('deduplicates concurrent idempotent schedule requests', async () => {
    const { scheduleEmails } = await import('../src/services/scheduling.js');
    const sender = await prisma.sender.create({ data: { name: 'Integration Sender', email: `${randomUUID()}@example.com` } });
    try {
      const input = { senderId: sender.id, recipients: [`${randomUUID()}@example.com`], subject: 'Integration', body: 'Integration', startTime: new Date(Date.now() + 3600000), delayBetweenEmailsMs: 1000, maxEmailsPerHour: 10, idempotencyKey: `integration-${randomUUID()}` };
      const results = await Promise.all([scheduleEmails(input), scheduleEmails(input)]);
      expect(results[0].id).toBe(results[1].id);
      expect(await prisma.schedule.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    } finally { await prisma.sender.delete({ where: { id: sender.id } }); }
  });

  it('enforces a sender hourly limit across concurrent reservations', async () => {
    const { reserveSend } = await import('../src/services/rateLimiter.js');
    const senderId = `integration-rate-${randomUUID()}`;
    const key = `outreachos:sender-rate:${senderId}`;
    try {
      await redisConnection.del(key);
      const decisions = await Promise.all(Array.from({ length: 4 }, () => reserveSend(senderId, 0, 2)));
      expect(decisions.filter((decision) => decision.allowed)).toHaveLength(2);
    } finally { await redisConnection.del(key); await redisConnection.quit(); }
  });
});
