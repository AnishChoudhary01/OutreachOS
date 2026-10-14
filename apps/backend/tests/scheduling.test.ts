import { describe, expect, it } from 'vitest';
import { stableJobId } from '../src/queues/emailQueue.js';
import { scheduleSchema } from '../src/routes/emails.js';
import { executionTimes, normalizeRecipients } from '../src/services/scheduling.js';
import { isTransient } from '../src/workers/emailWorker.js';
import { decryptSecret, encryptSecret, hashToken } from '../src/services/crypto.js';
import { requireAuth } from '../src/middleware/auth.js';

describe('schedule validation', () => {
  const valid = { senderId: 'sender-1', recipients: ['A@example.com'], subject: 'Subject', body: 'Body', startTime: '2026-12-20T10:00:00.000Z', delayBetweenEmailsMs: 2000, maxEmailsPerHour: 100, idempotencyKey: 'unique-key-1' };
  it('accepts a valid request and rejects invalid recipients', () => { expect(scheduleSchema.parse(valid).recipients).toEqual(['A@example.com']); expect(() => scheduleSchema.parse({ ...valid, recipients: ['bad'] })).toThrow(); });
  it('rejects invalid dates and unreasonable settings', () => { expect(() => scheduleSchema.parse({ ...valid, startTime: 'not-a-date' })).toThrow(); expect(() => scheduleSchema.parse({ ...valid, maxEmailsPerHour: 0 })).toThrow(); });
});

describe('scheduling helpers', () => {
  it('deduplicates and normalizes recipients', () => { expect(normalizeRecipients([' A@EXAMPLE.COM ', 'a@example.com', 'b@example.com'])).toEqual(['a@example.com', 'b@example.com']); });
  it('calculates deterministic execution times', () => { const result = executionTimes(new Date('2026-12-20T10:00:00.000Z'), 2000, 3); expect(result.map((d) => d.toISOString())).toEqual(['2026-12-20T10:00:00.000Z', '2026-12-20T10:00:02.000Z', '2026-12-20T10:00:04.000Z']); });
  it('derives stable BullMQ job IDs', () => { expect(stableJobId('email-123')).toBe('email:email-123'); expect(stableJobId('email-123')).toBe(stableJobId('email-123')); });
});

describe('delivery failure classification', () => {
  it('retries transient transport failures and does not retry permanent failures', () => { expect(isTransient(new Error('SMTP 450 temporary failure'))).toBe(true); expect(isTransient(new Error('SMTP 550 mailbox unavailable'))).toBe(false); });
});

describe('authentication crypto helpers', () => {
  it('round-trips encrypted integration tokens and hashes session tokens', () => { const value = 'xoxb-secret'; expect(decryptSecret(encryptSecret(value))).toBe(value); expect(hashToken('session')).toHaveLength(64); });
  it('rejects unauthenticated requests at the middleware boundary', () => { const res = { status: (code: number) => ({ json: (body: unknown) => ({ code, body }) }) } as any; expect(requireAuth({} as any, res, () => undefined)).toEqual({ code: 401, body: { error: 'Authentication required' } }); });
});
